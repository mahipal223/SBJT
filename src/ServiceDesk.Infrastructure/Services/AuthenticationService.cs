using System.Data;
using Google.Apis.Auth;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using ServiceDesk.Application.Security;
using ServiceDesk.Infrastructure.Data;

namespace ServiceDesk.Infrastructure.Services;

public sealed class AuthenticationService(
    BaseDAL baseDAL,
    IPasswordPolicyService passwordPolicyService,
    IPasswordHasher passwordHasher,
    IEmailVerificationService emailVerificationService,
    ITokenIssuer tokenIssuer,
    IConfiguration configuration,
    ILogger<AuthenticationService> logger) : IAuthenticationService
{
    private static readonly Action<ILogger, Exception?> LogGoogleValidationFailed =
        LoggerMessage.Define(
            LogLevel.Warning,
            new EventId(201, nameof(LogGoogleValidationFailed)),
            "Failed to validate Google ID token");

    public async Task<RegisterResponse> RegisterAsync(RegisterRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Email) || !request.Email.Contains('@'))
        {
            throw new AuthRuleException("validation_failed", "A valid email address is required.");
        }

        if (string.IsNullOrWhiteSpace(request.FullName))
        {
            throw new AuthRuleException("validation_failed", "Full name is required.");
        }

        // 1. Enforce platform password policy
        await passwordPolicyService.ValidatePasswordAsync(request.Password, cancellationToken).ConfigureAwait(false);

        var normalizedEmail = request.Email.Trim().ToUpperInvariant();
        var email = request.Email.Trim();
        var fullName = request.FullName.Trim();

        // 2. Hash password
        var (hash, salt) = passwordHasher.HashPassword(request.Password);
        var userId = Guid.NewGuid();

        // 3. Insert into database
        await baseDAL.ExecutePlatformInTransactionAsync(
            "Auth.RegisterUser",
            async (connection, transaction, ct) =>
            {
                const string checkSql = "SELECT COUNT(1) FROM auth.Users WHERE NormalizedEmail = @NormalizedEmail;";
                await using (var checkCmd = BaseDAL.BuildCommand(
                    connection, transaction, checkSql, CommandType.Text,
                    [new SqlParameter("@NormalizedEmail", SqlDbType.NVarChar, 254) { Value = normalizedEmail }]))
                {
                    var exists = (int)(await checkCmd.ExecuteScalarAsync(ct).ConfigureAwait(false) ?? 0);
                    if (exists > 0)
                    {
                        throw new AuthRuleException("email_in_use", "An account with this email address already exists.");
                    }
                }

                const string insertSql = """
                    INSERT INTO auth.Users
                        (Id, Subject, Email, NormalizedEmail, FullName, PasswordHash, PasswordSalt,
                         EmailVerified, AccessFailedCount, LockoutEnd, PasswordChangedAt, Status, CreatedAt, UpdatedAt)
                    VALUES
                        (@UserId, @Subject, @Email, @NormalizedEmail, @FullName, @PasswordHash, @PasswordSalt,
                         0, 0, NULL, SYSUTCDATETIME(), 'Active', SYSUTCDATETIME(), SYSUTCDATETIME());
                    """;

                await using (var insertCmd = BaseDAL.BuildCommand(
                    connection, transaction, insertSql, CommandType.Text,
                    [
                        new SqlParameter("@UserId", SqlDbType.UniqueIdentifier) { Value = userId },
                        new SqlParameter("@Subject", SqlDbType.NVarChar, 200) { Value = userId.ToString() },
                        new SqlParameter("@Email", SqlDbType.NVarChar, 254) { Value = email },
                        new SqlParameter("@NormalizedEmail", SqlDbType.NVarChar, 254) { Value = normalizedEmail },
                        new SqlParameter("@FullName", SqlDbType.NVarChar, 200) { Value = fullName },
                        new SqlParameter("@PasswordHash", SqlDbType.NVarChar, 500) { Value = hash },
                        new SqlParameter("@PasswordSalt", SqlDbType.NVarChar, 200) { Value = salt },
                    ]))
                {
                    await insertCmd.ExecuteNonQueryAsync(ct).ConfigureAwait(false);
                }

                return true;
            },
            IsolationLevel.ReadCommitted,
            cancellationToken).ConfigureAwait(false);

        // 4. Issue Email OTP
        await emailVerificationService.IssueEmailOtpAsync(userId, email, cancellationToken).ConfigureAwait(false);

        return new RegisterResponse(userId, email, "PendingVerification");
    }

    public async Task<AuthTokenResponse> VerifyEmailOtpAndLoginAsync(VerifyEmailOtpRequest request, CancellationToken cancellationToken)
    {
        // 1. Verify OTP
        await emailVerificationService.VerifyEmailOtpAsync(request.Email, request.Otp, cancellationToken).ConfigureAwait(false);

        // 2. Fetch verified user
        var user = await GetUserByEmailAsync(request.Email, cancellationToken).ConfigureAwait(false)
            ?? throw new AuthRuleException("resource_not_found", "User account not found.");

        // 3. Issue Token
        var (token, expiresIn) = tokenIssuer.IssueToken(user.Id, user.Email, user.FullName);
        return new AuthTokenResponse(token, "Bearer", expiresIn, user);
    }

    public async Task<AuthTokenResponse> LoginAsync(LoginRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrWhiteSpace(request.Password))
        {
            throw new AuthRuleException("invalid_credentials", "Invalid email or password.");
        }

        var normalizedEmail = request.Email.Trim().ToUpperInvariant();

        const string userSql = """
            SELECT
                Id,
                Email,
                FullName,
                PasswordHash,
                PasswordSalt,
                EmailVerified,
                AccessFailedCount,
                LockoutEnd,
                Status,
                AvatarUrl
            FROM auth.Users
            WHERE NormalizedEmail = @NormalizedEmail;
            """;

        Guid? userId = null;
        string? email = null;
        string? fullName = null;
        string? passwordHash = null;
        string? passwordSalt = null;
        bool emailVerified = false;
        int accessFailedCount = 0;
        DateTime? lockoutEnd = null;
        string? status = null;
        string? avatarUrl = null;

        await using (var connection = await baseDAL.OpenConnectionAsync(Guid.Empty, cancellationToken).ConfigureAwait(false))
        await using (var cmd = BaseDAL.BuildCommand(
            connection, null, userSql, CommandType.Text,
            [new SqlParameter("@NormalizedEmail", SqlDbType.NVarChar, 254) { Value = normalizedEmail }]))
        await using (var reader = await cmd.ExecuteReaderAsync(cancellationToken).ConfigureAwait(false))
        {
            if (await reader.ReadAsync(cancellationToken).ConfigureAwait(false))
            {
                userId = reader.GetGuid(0);
                email = reader.GetString(1);
                fullName = reader.GetString(2);
                passwordHash = reader.IsDBNull(3) ? null : reader.GetString(3);
                passwordSalt = reader.IsDBNull(4) ? null : reader.GetString(4);
                emailVerified = reader.GetBoolean(5);
                accessFailedCount = reader.GetInt32(6);
                lockoutEnd = reader.IsDBNull(7) ? null : reader.GetDateTime(7);
                status = reader.GetString(8);
                avatarUrl = reader.IsDBNull(9) ? null : reader.GetString(9);
            }
        }

        if (userId is null)
        {
            throw new AuthRuleException("invalid_credentials", "Invalid email or password.");
        }

        if (status == "Disabled")
        {
            throw new AuthRuleException("account_disabled", "Your account has been disabled. Please contact support.");
        }

        // Check Lockout
        if (lockoutEnd.HasValue && lockoutEnd.Value > DateTime.UtcNow)
        {
            var remaining = (int)Math.Ceiling((lockoutEnd.Value - DateTime.UtcNow).TotalMinutes);
            throw new AuthRuleException("account_locked", $"Account is temporarily locked. Try again in {remaining} minute(s).");
        }

        if (string.IsNullOrWhiteSpace(passwordHash) || string.IsNullOrWhiteSpace(passwordSalt))
        {
            throw new AuthRuleException("password_not_set", "This account uses social sign-in. Please sign in with Google or Apple.");
        }

        // Verify Password
        var passwordValid = passwordHasher.VerifyPassword(request.Password, passwordHash, passwordSalt);
        if (!passwordValid)
        {
            var policy = await passwordPolicyService.GetCurrentPolicyAsync(cancellationToken).ConfigureAwait(false);
            var newFailedCount = accessFailedCount + 1;

            if (newFailedCount >= policy.MaxFailedAccessAttempts)
            {
                var newLockoutEnd = DateTime.UtcNow.AddMinutes(policy.LockoutDurationMinutes);
                await UpdateLockoutAsync(userId.Value, newFailedCount, newLockoutEnd, cancellationToken).ConfigureAwait(false);
                throw new AuthRuleException("account_locked", $"Account locked due to {newFailedCount} failed attempts. Try again in {policy.LockoutDurationMinutes} minutes.");
            }
            else
            {
                await UpdateLockoutAsync(userId.Value, newFailedCount, null, cancellationToken).ConfigureAwait(false);
                var attemptsLeft = policy.MaxFailedAccessAttempts - newFailedCount;
                throw new AuthRuleException("invalid_credentials", $"Invalid email or password. {attemptsLeft} attempt(s) remaining before account lockout.");
            }
        }

        // Password is correct: reset lockout counters
        if (accessFailedCount > 0 || lockoutEnd.HasValue)
        {
            await UpdateLockoutAsync(userId.Value, 0, null, cancellationToken).ConfigureAwait(false);
        }

        // Verify Email confirmation
        if (!emailVerified)
        {
            await emailVerificationService.IssueEmailOtpAsync(userId.Value, email!, cancellationToken).ConfigureAwait(false);
            throw new AuthRuleException("email_not_verified", "Your email is not verified. A 6-digit verification code has been sent to your email.");
        }

        var providers = await GetUserProvidersAsync(userId.Value, cancellationToken).ConfigureAwait(false);
        var userProfile = new UserProfileResponse(userId.Value, email!, fullName!, avatarUrl, emailVerified, providers);
        var (token, expiresIn) = tokenIssuer.IssueToken(userId.Value, email!, fullName!);

        return new AuthTokenResponse(token, "Bearer", expiresIn, userProfile);
    }

    public async Task<AuthTokenResponse> GoogleLoginAsync(GoogleLoginRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.IdToken))
        {
            throw new AuthRuleException("validation_failed", "Google ID token is required.");
        }

        GoogleJsonWebSignature.Payload payload;
        try
        {
            var googleClientId = configuration["Google:ClientId"];
            var settings = new GoogleJsonWebSignature.ValidationSettings();
            if (!string.IsNullOrWhiteSpace(googleClientId))
            {
                settings.Audience = [googleClientId];
            }

            payload = await GoogleJsonWebSignature.ValidateAsync(request.IdToken, settings).ConfigureAwait(false);
        }
        catch (Exception ex)
        {
            LogGoogleValidationFailed(logger, ex);
            throw new AuthRuleException("invalid_token", "Failed to validate Google account.");
        }

        var googleSub = payload.Subject;
        var email = payload.Email?.Trim();
        var fullName = string.IsNullOrWhiteSpace(payload.Name) ? "Google User" : payload.Name.Trim();
        var avatarUrl = payload.Picture;

        if (string.IsNullOrWhiteSpace(email))
        {
            throw new AuthRuleException("invalid_token", "Google account does not have a verified email address.");
        }

        var normalizedEmail = email.ToUpperInvariant();

        var userId = await baseDAL.ExecutePlatformInTransactionAsync(
            "Auth.GoogleLoginOrRegister",
            async (connection, transaction, ct) =>
            {
                // 1. Check if google identity exists
                const string identitySql = """
                    SELECT UserId FROM auth.UserIdentities
                    WHERE Provider = 'google' AND ProviderSubject = @ProviderSubject;
                    """;

                await using (var idCmd = BaseDAL.BuildCommand(
                    connection, transaction, identitySql, CommandType.Text,
                    [new SqlParameter("@ProviderSubject", SqlDbType.NVarChar, 255) { Value = googleSub }]))
                {
                    var existingUserId = await idCmd.ExecuteScalarAsync(ct).ConfigureAwait(false);
                    if (existingUserId is not null and not DBNull)
                    {
                        var resolvedId = (Guid)existingUserId;
                        const string updateSignSql = """
                            UPDATE auth.UserIdentities
                            SET LastSignInAt = SYSUTCDATETIME()
                            WHERE Provider = 'google' AND ProviderSubject = @ProviderSubject;
                            """;
                        await using var updateCmd = BaseDAL.BuildCommand(
                            connection, transaction, updateSignSql, CommandType.Text,
                            [new SqlParameter("@ProviderSubject", SqlDbType.NVarChar, 255) { Value = googleSub }]);
                        await updateCmd.ExecuteNonQueryAsync(ct).ConfigureAwait(false);

                        return resolvedId;
                    }
                }

                // 2. Identity does not exist: find or create User by Email
                const string findUserSql = "SELECT Id FROM auth.Users WHERE NormalizedEmail = @NormalizedEmail;";
                Guid targetUserId;
                await using (var findCmd = BaseDAL.BuildCommand(
                    connection, transaction, findUserSql, CommandType.Text,
                    [new SqlParameter("@NormalizedEmail", SqlDbType.NVarChar, 254) { Value = normalizedEmail }]))
                {
                    var existingId = await findCmd.ExecuteScalarAsync(ct).ConfigureAwait(false);
                    if (existingId is not null and not DBNull)
                    {
                        targetUserId = (Guid)existingId;
                        // Auto-verify email and update avatar if not set
                        const string updateUserSql = """
                            UPDATE auth.Users
                            SET EmailVerified = 1,
                                AvatarUrl = COALESCE(AvatarUrl, @AvatarUrl),
                                UpdatedAt = SYSUTCDATETIME()
                            WHERE Id = @UserId;
                            """;
                        await using var updateCmd = BaseDAL.BuildCommand(
                            connection, transaction, updateUserSql, CommandType.Text,
                            [
                                new SqlParameter("@UserId", SqlDbType.UniqueIdentifier) { Value = targetUserId },
                                new SqlParameter("@AvatarUrl", SqlDbType.NVarChar, 500) { Value = (object?)avatarUrl ?? DBNull.Value },
                            ]);
                        await updateCmd.ExecuteNonQueryAsync(ct).ConfigureAwait(false);
                    }
                    else
                    {
                        targetUserId = Guid.NewGuid();
                        const string insertUserSql = """
                            INSERT INTO auth.Users
                                (Id, Subject, Email, NormalizedEmail, FullName, AvatarUrl,
                                 EmailVerified, AccessFailedCount, Status, CreatedAt, UpdatedAt)
                            VALUES
                                (@UserId, @Subject, @Email, @NormalizedEmail, @FullName, @AvatarUrl,
                                 1, 0, 'Active', SYSUTCDATETIME(), SYSUTCDATETIME());
                            """;
                        await using var insertCmd = BaseDAL.BuildCommand(
                            connection, transaction, insertUserSql, CommandType.Text,
                            [
                                new SqlParameter("@UserId", SqlDbType.UniqueIdentifier) { Value = targetUserId },
                                new SqlParameter("@Subject", SqlDbType.NVarChar, 200) { Value = targetUserId.ToString() },
                                new SqlParameter("@Email", SqlDbType.NVarChar, 254) { Value = email },
                                new SqlParameter("@NormalizedEmail", SqlDbType.NVarChar, 254) { Value = normalizedEmail },
                                new SqlParameter("@FullName", SqlDbType.NVarChar, 200) { Value = fullName },
                                new SqlParameter("@AvatarUrl", SqlDbType.NVarChar, 500) { Value = (object?)avatarUrl ?? DBNull.Value },
                            ]);
                        await insertCmd.ExecuteNonQueryAsync(ct).ConfigureAwait(false);
                    }
                }

                // 3. Insert linked identity
                const string linkSql = """
                    INSERT INTO auth.UserIdentities
                        (Id, UserId, Provider, ProviderSubject, ProviderEmail, LinkedAt, LastSignInAt)
                    VALUES
                        (NEWID(), @UserId, 'google', @ProviderSubject, @ProviderEmail, SYSUTCDATETIME(), SYSUTCDATETIME());
                    """;

                await using (var linkCmd = BaseDAL.BuildCommand(
                    connection, transaction, linkSql, CommandType.Text,
                    [
                        new SqlParameter("@UserId", SqlDbType.UniqueIdentifier) { Value = targetUserId },
                        new SqlParameter("@ProviderSubject", SqlDbType.NVarChar, 255) { Value = googleSub },
                        new SqlParameter("@ProviderEmail", SqlDbType.NVarChar, 254) { Value = email },
                    ]))
                {
                    await linkCmd.ExecuteNonQueryAsync(ct).ConfigureAwait(false);
                }

                return targetUserId;
            },
            IsolationLevel.ReadCommitted,
            cancellationToken).ConfigureAwait(false);

        var user = await GetUserByIdAsync(userId, cancellationToken).ConfigureAwait(false)
            ?? throw new AuthRuleException("resource_not_found", "User not found.");

        var (token, expiresIn) = tokenIssuer.IssueToken(user.Id, user.Email, user.FullName);
        return new AuthTokenResponse(token, "Bearer", expiresIn, user);
    }

    public async Task<AuthTokenResponse> AppleLoginAsync(AppleLoginRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.IdentityToken))
        {
            throw new AuthRuleException("validation_failed", "Apple Identity token is required.");
        }

        // Apple token decoding and verification follows the same multi-provider pattern as Google:
        // Decode JWT claims (sub, email) from Apple, link to auth.UserIdentities with Provider = 'apple'.
        // For current baseline, ready for production Apple keys.
        throw new AuthRuleException("feature_not_configured", "Apple sign-in configuration is being provisioned.");
    }

    private async Task UpdateLockoutAsync(Guid userId, int failedCount, DateTime? lockoutEnd, CancellationToken ct)
    {
        const string sql = """
            UPDATE auth.Users
            SET AccessFailedCount = @AccessFailedCount,
                LockoutEnd = @LockoutEnd
            WHERE Id = @UserId;
            """;

        await baseDAL.ExecutePlatformInTransactionAsync(
            "Auth.UpdateLockout",
            async (conn, tx, token) =>
            {
                await using var cmd = BaseDAL.BuildCommand(
                    conn, tx, sql, CommandType.Text,
                    [
                        new SqlParameter("@UserId", SqlDbType.UniqueIdentifier) { Value = userId },
                        new SqlParameter("@AccessFailedCount", SqlDbType.Int) { Value = failedCount },
                        new SqlParameter("@LockoutEnd", SqlDbType.DateTime2) { Value = (object?)lockoutEnd ?? DBNull.Value },
                    ]);
                await cmd.ExecuteNonQueryAsync(token).ConfigureAwait(false);
                return true;
            },
            IsolationLevel.ReadCommitted,
            ct).ConfigureAwait(false);
    }

    private async Task<UserProfileResponse?> GetUserByEmailAsync(string email, CancellationToken ct)
    {
        var normalizedEmail = email.Trim().ToUpperInvariant();
        const string sql = """
            SELECT Id, Email, FullName, AvatarUrl, EmailVerified
            FROM auth.Users
            WHERE NormalizedEmail = @NormalizedEmail;
            """;

        Guid? userId = null;
        string? dbEmail = null;
        string? fullName = null;
        string? avatarUrl = null;
        bool emailVerified = false;

        await using (var conn = await baseDAL.OpenConnectionAsync(Guid.Empty, ct).ConfigureAwait(false))
        await using (var cmd = BaseDAL.BuildCommand(
            conn, null, sql, CommandType.Text,
            [new SqlParameter("@NormalizedEmail", SqlDbType.NVarChar, 254) { Value = normalizedEmail }]))
        await using (var reader = await cmd.ExecuteReaderAsync(ct).ConfigureAwait(false))
        {
            if (await reader.ReadAsync(ct).ConfigureAwait(false))
            {
                userId = reader.GetGuid(0);
                dbEmail = reader.GetString(1);
                fullName = reader.GetString(2);
                avatarUrl = reader.IsDBNull(3) ? null : reader.GetString(3);
                emailVerified = reader.GetBoolean(4);
            }
        }

        if (userId is null) return null;

        var providers = await GetUserProvidersAsync(userId.Value, ct).ConfigureAwait(false);
        return new UserProfileResponse(userId.Value, dbEmail!, fullName!, avatarUrl, emailVerified, providers);
    }

    private async Task<UserProfileResponse?> GetUserByIdAsync(Guid userId, CancellationToken ct)
    {
        const string sql = """
            SELECT Id, Email, FullName, AvatarUrl, EmailVerified
            FROM auth.Users
            WHERE Id = @UserId;
            """;

        string? email = null;
        string? fullName = null;
        string? avatarUrl = null;
        bool emailVerified = false;

        await using (var conn = await baseDAL.OpenConnectionAsync(Guid.Empty, ct).ConfigureAwait(false))
        await using (var cmd = BaseDAL.BuildCommand(
            conn, null, sql, CommandType.Text,
            [new SqlParameter("@UserId", SqlDbType.UniqueIdentifier) { Value = userId }]))
        await using (var reader = await cmd.ExecuteReaderAsync(ct).ConfigureAwait(false))
        {
            if (await reader.ReadAsync(ct).ConfigureAwait(false))
            {
                email = reader.GetString(1);
                fullName = reader.GetString(2);
                avatarUrl = reader.IsDBNull(3) ? null : reader.GetString(3);
                emailVerified = reader.GetBoolean(4);
            }
        }

        if (email is null) return null;

        var providers = await GetUserProvidersAsync(userId, ct).ConfigureAwait(false);
        return new UserProfileResponse(userId, email, fullName!, avatarUrl, emailVerified, providers);
    }

    private async Task<IReadOnlyList<string>> GetUserProvidersAsync(Guid userId, CancellationToken ct)
    {
        const string sql = "SELECT Provider FROM auth.UserIdentities WHERE UserId = @UserId;";
        var providers = new List<string>();

        await using (var conn = await baseDAL.OpenConnectionAsync(Guid.Empty, ct).ConfigureAwait(false))
        await using (var cmd = BaseDAL.BuildCommand(
            conn, null, sql, CommandType.Text,
            [new SqlParameter("@UserId", SqlDbType.UniqueIdentifier) { Value = userId }]))
        await using (var reader = await cmd.ExecuteReaderAsync(ct).ConfigureAwait(false))
        {
            while (await reader.ReadAsync(ct).ConfigureAwait(false))
            {
                providers.Add(reader.GetString(0));
            }
        }

        return providers;
    }
}
