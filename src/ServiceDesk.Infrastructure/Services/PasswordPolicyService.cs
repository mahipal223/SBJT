using System.Data;
using System.Text.Json;
using Microsoft.Data.SqlClient;
using ServiceDesk.Application.Security;
using ServiceDesk.Infrastructure.Data;

namespace ServiceDesk.Infrastructure.Services;

public sealed class PasswordPolicyService(BaseDAL baseDAL) : IPasswordPolicyService
{
    private static readonly PasswordPolicyResponse DefaultPolicy = new(
        MinLength: 8,
        MaxLength: 128,
        RequireUppercase: true,
        RequireLowercase: true,
        RequireDigit: true,
        RequireNonAlphanumeric: true,
        MaxFailedAccessAttempts: 5,
        LockoutDurationMinutes: 15,
        PasswordExpirationDays: null,
        PreventPasswordReuseCount: 3,
        UpdatedAt: DateTime.UtcNow);

    public async Task<PasswordPolicyResponse> GetCurrentPolicyAsync(CancellationToken cancellationToken)
    {
        const string sql = """
            SELECT TOP 1
                MinLength,
                MaxLength,
                RequireUppercase,
                RequireLowercase,
                RequireDigit,
                RequireNonAlphanumeric,
                MaxFailedAccessAttempts,
                LockoutDurationMinutes,
                PasswordExpirationDays,
                PreventPasswordReuseCount,
                UpdatedAt
            FROM platform.PasswordPolicies
            ORDER BY UpdatedAt DESC;
            """;

        var policy = await baseDAL.ExecutePlatformSingleAsync(
            "Security.GetPasswordPolicy",
            sql,
            reader => new PasswordPolicyResponse(
                reader.GetInt32(0),
                reader.GetInt32(1),
                reader.GetBoolean(2),
                reader.GetBoolean(3),
                reader.GetBoolean(4),
                reader.GetBoolean(5),
                reader.GetInt32(6),
                reader.GetInt32(7),
                reader.IsDBNull(8) ? null : reader.GetInt32(8),
                reader.GetInt32(9),
                reader.GetDateTime(10)),
            null,
            cancellationToken).ConfigureAwait(false);

        return policy ?? DefaultPolicy;
    }

    public async Task<PasswordPolicyResponse> UpdatePolicyAsync(
        UpdatePasswordPolicyRequest request,
        Guid adminUserId,
        CancellationToken cancellationToken)
    {
        if (request.MinLength < 8)
        {
            throw new AuthRuleException("validation_failed", "Minimum password length must be at least 8 characters.");
        }
        if (request.MaxLength > 128 || request.MaxLength < request.MinLength)
        {
            throw new AuthRuleException("validation_failed", "Maximum password length must be between minimum length and 128.");
        }
        if (request.MaxFailedAccessAttempts < 3)
        {
            throw new AuthRuleException("validation_failed", "Max failed access attempts must be at least 3.");
        }
        if (request.LockoutDurationMinutes < 1)
        {
            throw new AuthRuleException("validation_failed", "Lockout duration must be at least 1 minute.");
        }

        return await baseDAL.ExecutePlatformInTransactionAsync(
            "Security.UpdatePasswordPolicy",
            async (connection, transaction, ct) =>
            {
                const string upsertSql = """
                    IF EXISTS (SELECT 1 FROM platform.PasswordPolicies)
                    BEGIN
                        UPDATE platform.PasswordPolicies
                        SET MinLength = @MinLength,
                            MaxLength = @MaxLength,
                            RequireUppercase = @RequireUppercase,
                            RequireLowercase = @RequireLowercase,
                            RequireDigit = @RequireDigit,
                            RequireNonAlphanumeric = @RequireNonAlphanumeric,
                            MaxFailedAccessAttempts = @MaxFailedAccessAttempts,
                            LockoutDurationMinutes = @LockoutDurationMinutes,
                            PasswordExpirationDays = @PasswordExpirationDays,
                            PreventPasswordReuseCount = @PreventPasswordReuseCount,
                            UpdatedAt = SYSUTCDATETIME(),
                            UpdatedByUserId = @AdminUserId;
                    END
                    ELSE
                    BEGIN
                        INSERT INTO platform.PasswordPolicies
                            (MinLength, MaxLength, RequireUppercase, RequireLowercase, RequireDigit, RequireNonAlphanumeric,
                             MaxFailedAccessAttempts, LockoutDurationMinutes, PasswordExpirationDays, PreventPasswordReuseCount,
                             UpdatedAt, UpdatedByUserId)
                        VALUES
                            (@MinLength, @MaxLength, @RequireUppercase, @RequireLowercase, @RequireDigit, @RequireNonAlphanumeric,
                             @MaxFailedAccessAttempts, @LockoutDurationMinutes, @PasswordExpirationDays, @PreventPasswordReuseCount,
                             SYSUTCDATETIME(), @AdminUserId);
                    END
                    """;

                await using (var cmd = BaseDAL.BuildCommand(
                    connection,
                    transaction,
                    upsertSql,
                    CommandType.Text,
                    [
                        new SqlParameter("@MinLength", SqlDbType.Int) { Value = request.MinLength },
                        new SqlParameter("@MaxLength", SqlDbType.Int) { Value = request.MaxLength },
                        new SqlParameter("@RequireUppercase", SqlDbType.Bit) { Value = request.RequireUppercase },
                        new SqlParameter("@RequireLowercase", SqlDbType.Bit) { Value = request.RequireLowercase },
                        new SqlParameter("@RequireDigit", SqlDbType.Bit) { Value = request.RequireDigit },
                        new SqlParameter("@RequireNonAlphanumeric", SqlDbType.Bit) { Value = request.RequireNonAlphanumeric },
                        new SqlParameter("@MaxFailedAccessAttempts", SqlDbType.Int) { Value = request.MaxFailedAccessAttempts },
                        new SqlParameter("@LockoutDurationMinutes", SqlDbType.Int) { Value = request.LockoutDurationMinutes },
                        new SqlParameter("@PasswordExpirationDays", SqlDbType.Int) { Value = (object?)request.PasswordExpirationDays ?? DBNull.Value },
                        new SqlParameter("@PreventPasswordReuseCount", SqlDbType.Int) { Value = request.PreventPasswordReuseCount },
                        new SqlParameter("@AdminUserId", SqlDbType.UniqueIdentifier) { Value = adminUserId },
                    ]))
                {
                    await cmd.ExecuteNonQueryAsync(ct).ConfigureAwait(false);
                }

                // Record audit event in platform.AdminAuditEvents
                const string auditSql = """
                    INSERT INTO platform.AdminAuditEvents
                        (Id, ActorUserId, BusinessId, Action, Details, CreatedAt)
                    VALUES
                        (NEWID(), @ActorUserId, NULL, 'Security.PasswordPolicyUpdated', @Details, SYSUTCDATETIME());
                    """;

                var detailsJson = JsonSerializer.Serialize(new
                {
                    request.MinLength,
                    request.MaxLength,
                    request.RequireUppercase,
                    request.RequireLowercase,
                    request.RequireDigit,
                    request.RequireNonAlphanumeric,
                    request.MaxFailedAccessAttempts,
                    request.LockoutDurationMinutes,
                    request.PasswordExpirationDays,
                    request.PreventPasswordReuseCount
                });

                await using (var auditCmd = BaseDAL.BuildCommand(
                    connection,
                    transaction,
                    auditSql,
                    CommandType.Text,
                    [
                        new SqlParameter("@ActorUserId", SqlDbType.UniqueIdentifier) { Value = adminUserId },
                        new SqlParameter("@Details", SqlDbType.NVarChar, -1) { Value = detailsJson },
                    ]))
                {
                    await auditCmd.ExecuteNonQueryAsync(ct).ConfigureAwait(false);
                }

                return new PasswordPolicyResponse(
                    request.MinLength,
                    request.MaxLength,
                    request.RequireUppercase,
                    request.RequireLowercase,
                    request.RequireDigit,
                    request.RequireNonAlphanumeric,
                    request.MaxFailedAccessAttempts,
                    request.LockoutDurationMinutes,
                    request.PasswordExpirationDays,
                    request.PreventPasswordReuseCount,
                    DateTime.UtcNow);
            },
            IsolationLevel.ReadCommitted,
            cancellationToken).ConfigureAwait(false);
    }

    public async Task ValidatePasswordAsync(string password, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(password))
        {
            throw new AuthRuleException("password_required", "A password is required.");
        }

        var policy = await GetCurrentPolicyAsync(cancellationToken).ConfigureAwait(false);

        if (password.Length < policy.MinLength)
        {
            throw new AuthRuleException("password_too_short", $"Password must be at least {policy.MinLength} characters long.");
        }

        if (password.Length > policy.MaxLength)
        {
            throw new AuthRuleException("password_too_long", $"Password cannot exceed {policy.MaxLength} characters.");
        }

        if (policy.RequireUppercase && !password.Any(char.IsUpper))
        {
            throw new AuthRuleException("password_requires_uppercase", "Password must contain at least one uppercase letter.");
        }

        if (policy.RequireLowercase && !password.Any(char.IsLower))
        {
            throw new AuthRuleException("password_requires_lowercase", "Password must contain at least one lowercase letter.");
        }

        if (policy.RequireDigit && !password.Any(char.IsDigit))
        {
            throw new AuthRuleException("password_requires_digit", "Password must contain at least one digit.");
        }

        if (policy.RequireNonAlphanumeric && !password.Any(ch => !char.IsLetterOrDigit(ch)))
        {
            throw new AuthRuleException("password_requires_special_char", "Password must contain at least one special character (!@#$%^&* etc.).");
        }
    }
}
