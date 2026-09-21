using System.Data;
using System.Security.Cryptography;
using System.Text;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Logging;
using ServiceDesk.Application.Security;
using ServiceDesk.Infrastructure.Data;
using ServiceDesk.Infrastructure.Notifications;

namespace ServiceDesk.Infrastructure.Services;

public sealed class EmailVerificationService(
    BaseDAL baseDAL,
    IEmailSender emailSender,
    ILogger<EmailVerificationService> logger) : IEmailVerificationService
{
    private const int OtpExpiryMinutes = 10;
    private const int MaxAttempts = 5;

    private static readonly Action<ILogger, string, string, Exception?> LogOtpGenerated =
        LoggerMessage.Define<string, string>(
            LogLevel.Information,
            new EventId(101, nameof(LogOtpGenerated)),
            "[EmailVerification] Generated OTP for {Email}: {Otp}");

    private static readonly Action<ILogger, string, Exception?> LogOtpEmailFailed =
        LoggerMessage.Define<string>(
            LogLevel.Warning,
            new EventId(102, nameof(LogOtpEmailFailed)),
            "Failed to send email OTP to {Email}. Developer code logged above.");

    public async Task IssueEmailOtpAsync(Guid userId, string email, CancellationToken cancellationToken)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(email);

        var normalizedEmail = email.Trim().ToUpperInvariant();
        var otpCode = RandomNumberGenerator.GetInt32(100000, 1000000).ToString("D6", System.Globalization.CultureInfo.InvariantCulture);
        var tokenHash = SHA256.HashData(Encoding.UTF8.GetBytes(otpCode));

        await baseDAL.ExecutePlatformInTransactionAsync(
            "Auth.IssueEmailOtp",
            async (connection, transaction, ct) =>
            {
                // Invalidate any existing unconsumed OTPs for this user
                const string invalidateSql = """
                    UPDATE auth.EmailVerifications
                    SET ConsumedAt = SYSUTCDATETIME()
                    WHERE UserId = @UserId AND ConsumedAt IS NULL;
                    """;

                await using (var invCmd = BaseDAL.BuildCommand(
                    connection, transaction, invalidateSql, CommandType.Text,
                    [new SqlParameter("@UserId", SqlDbType.UniqueIdentifier) { Value = userId }]))
                {
                    await invCmd.ExecuteNonQueryAsync(ct).ConfigureAwait(false);
                }

                // Insert new OTP verification record
                const string insertSql = """
                    INSERT INTO auth.EmailVerifications
                        (Id, UserId, Email, TokenHash, ExpiresAt, AttemptCount, ConsumedAt, CreatedAt)
                    VALUES
                        (NEWID(), @UserId, @Email, @TokenHash, DATEADD(minute, @ExpiryMinutes, SYSUTCDATETIME()), 0, NULL, SYSUTCDATETIME());
                    """;

                await using (var insertCmd = BaseDAL.BuildCommand(
                    connection, transaction, insertSql, CommandType.Text,
                    [
                        new SqlParameter("@UserId", SqlDbType.UniqueIdentifier) { Value = userId },
                        new SqlParameter("@Email", SqlDbType.NVarChar, 254) { Value = normalizedEmail },
                        new SqlParameter("@TokenHash", SqlDbType.VarBinary, 32) { Value = tokenHash },
                        new SqlParameter("@ExpiryMinutes", SqlDbType.Int) { Value = OtpExpiryMinutes },
                    ]))
                {
                    await insertCmd.ExecuteNonQueryAsync(ct).ConfigureAwait(false);
                }

                return true;
            },
            IsolationLevel.ReadCommitted,
            cancellationToken).ConfigureAwait(false);

        // Deliver OTP via email
        var subject = $"Your ServiceDesk Verification Code: {otpCode}";
        var body = $"""
            <h2>Verify Your Email Address</h2>
            <p>Welcome to ServiceDesk! Your 6-digit verification code is:</p>
            <h1 style="letter-spacing: 5px; color: #2563eb;">{otpCode}</h1>
            <p>This code will expire in {OtpExpiryMinutes} minutes. If you did not request this code, please ignore this email.</p>
            """;

        LogOtpGenerated(logger, email, otpCode, null);

        try
        {
            await emailSender.SendEmailAsync(Guid.Empty, email, subject, body, cancellationToken).ConfigureAwait(false);
        }
        catch (Exception ex)
        {
            LogOtpEmailFailed(logger, email, ex);
        }
    }

    public async Task<bool> VerifyEmailOtpAsync(string email, string otp, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(otp))
        {
            throw new AuthRuleException("invalid_otp", "Email and 6-digit verification code are required.");
        }

        var normalizedEmail = email.Trim().ToUpperInvariant();
        var tokenHash = SHA256.HashData(Encoding.UTF8.GetBytes(otp.Trim()));

        return await baseDAL.ExecutePlatformInTransactionAsync(
            "Auth.VerifyEmailOtp",
            async (connection, transaction, ct) =>
            {
                const string querySql = """
                    SELECT TOP 1
                        Id,
                        UserId,
                        TokenHash,
                        ExpiresAt,
                        AttemptCount
                    FROM auth.EmailVerifications
                    WHERE Email = @Email AND ConsumedAt IS NULL
                    ORDER BY CreatedAt DESC;
                    """;

                Guid? verificationId = null;
                Guid? userId = null;
                byte[]? expectedHash = null;
                DateTime? expiresAt = null;
                int attemptCount = 0;

                await using (var queryCmd = BaseDAL.BuildCommand(
                    connection, transaction, querySql, CommandType.Text,
                    [new SqlParameter("@Email", SqlDbType.NVarChar, 254) { Value = normalizedEmail }]))
                await using (var reader = await queryCmd.ExecuteReaderAsync(ct).ConfigureAwait(false))
                {
                    if (await reader.ReadAsync(ct).ConfigureAwait(false))
                    {
                        verificationId = reader.GetGuid(0);
                        userId = reader.GetGuid(1);
                        expectedHash = (byte[])reader[2];
                        expiresAt = reader.GetDateTime(3);
                        attemptCount = reader.GetInt32(4);
                    }
                }

                if (verificationId is null || expiresAt is null || expectedHash is null)
                {
                    throw new AuthRuleException("invalid_otp", "No active verification code found for this email. Please request a new code.");
                }

                if (DateTime.UtcNow > expiresAt.Value)
                {
                    throw new AuthRuleException("otp_expired", "The verification code has expired. Please request a new code.");
                }

                if (attemptCount >= MaxAttempts)
                {
                    throw new AuthRuleException("too_many_attempts", "Too many invalid attempts. Please request a new verification code.");
                }

                if (!CryptographicOperations.FixedTimeEquals(expectedHash, tokenHash))
                {
                    // Increment failed attempt count
                    const string incrementSql = """
                        UPDATE auth.EmailVerifications
                        SET AttemptCount = AttemptCount + 1
                        WHERE Id = @Id;
                        """;

                    await using var incCmd = BaseDAL.BuildCommand(
                        connection, transaction, incrementSql, CommandType.Text,
                        [new SqlParameter("@Id", SqlDbType.UniqueIdentifier) { Value = verificationId.Value }]);
                    await incCmd.ExecuteNonQueryAsync(ct).ConfigureAwait(false);

                    var remaining = MaxAttempts - (attemptCount + 1);
                    throw new AuthRuleException("invalid_otp", remaining > 0
                        ? $"Invalid verification code. You have {remaining} attempt(s) remaining."
                        : "Invalid verification code. Maximum attempts exceeded. Please request a new code.");
                }

                // Code matches: consume the OTP and activate user's email
                const string completeSql = """
                    UPDATE auth.EmailVerifications
                    SET ConsumedAt = SYSUTCDATETIME()
                    WHERE Id = @VerificationId;

                    UPDATE auth.Users
                    SET EmailVerified = 1,
                        UpdatedAt = SYSUTCDATETIME()
                    WHERE Id = @UserId;
                    """;

                await using (var completeCmd = BaseDAL.BuildCommand(
                    connection, transaction, completeSql, CommandType.Text,
                    [
                        new SqlParameter("@VerificationId", SqlDbType.UniqueIdentifier) { Value = verificationId.Value },
                        new SqlParameter("@UserId", SqlDbType.UniqueIdentifier) { Value = userId!.Value },
                    ]))
                {
                    await completeCmd.ExecuteNonQueryAsync(ct).ConfigureAwait(false);
                }

                return true;
            },
            IsolationLevel.ReadCommitted,
            cancellationToken).ConfigureAwait(false);
    }

    public async Task ResendEmailOtpAsync(string email, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(email))
        {
            throw new AuthRuleException("validation_failed", "A valid email address is required.");
        }

        var normalizedEmail = email.Trim().ToUpperInvariant();

        // Check user exists and get UserId and last created OTP
        const string checkSql = """
            SELECT TOP 1
                u.Id,
                u.EmailVerified,
                ev.CreatedAt
            FROM auth.Users AS u
            LEFT JOIN auth.EmailVerifications AS ev
                ON ev.UserId = u.Id AND ev.ConsumedAt IS NULL
            WHERE u.NormalizedEmail = @Email
            ORDER BY ev.CreatedAt DESC;
            """;

        Guid? userId = null;
        bool emailVerified = false;
        DateTime? lastOtpCreatedAt = null;

        await using (var conn = await baseDAL.OpenConnectionAsync(Guid.Empty, cancellationToken).ConfigureAwait(false))
        await using (var cmd = BaseDAL.BuildCommand(
            conn, null, checkSql, CommandType.Text,
            [new SqlParameter("@Email", SqlDbType.NVarChar, 254) { Value = normalizedEmail }]))
        await using (var reader = await cmd.ExecuteReaderAsync(cancellationToken).ConfigureAwait(false))
        {
            if (await reader.ReadAsync(cancellationToken).ConfigureAwait(false))
            {
                userId = reader.GetGuid(0);
                emailVerified = reader.GetBoolean(1);
                if (!reader.IsDBNull(2))
                {
                    lastOtpCreatedAt = reader.GetDateTime(2);
                }
            }
        }

        if (userId is null)
        {
            // Fail silently or generic message to prevent email enumeration
            return;
        }

        if (emailVerified)
        {
            throw new AuthRuleException("already_verified", "This email address is already verified.");
        }

        if (lastOtpCreatedAt.HasValue && (DateTime.UtcNow - lastOtpCreatedAt.Value).TotalSeconds < 60)
        {
            var waitSeconds = (int)(60 - (DateTime.UtcNow - lastOtpCreatedAt.Value).TotalSeconds);
            throw new AuthRuleException("rate_limited", $"Please wait {waitSeconds} seconds before requesting a new code.");
        }

        await IssueEmailOtpAsync(userId.Value, email, cancellationToken).ConfigureAwait(false);
    }
}
