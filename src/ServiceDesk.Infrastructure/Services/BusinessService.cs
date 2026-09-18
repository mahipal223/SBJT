using System.Data;
using System.Text.Json;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Logging;
using ServiceDesk.Application.Tenancy;
using ServiceDesk.Infrastructure.Data;

namespace ServiceDesk.Infrastructure.Services;

public sealed class BusinessService(
    BaseDAL baseDAL,
    ILogger<BusinessService> logger) : IBusinessService
{
    private static readonly Action<ILogger, Guid, string, Exception?> LogBusinessCreated =
        LoggerMessage.Define<Guid, string>(
            LogLevel.Information,
            new EventId(1101, nameof(LogBusinessCreated)),
            "Created new workspace {BusinessId} with name '{BusinessName}'.");

    private static readonly Action<ILogger, Guid, Exception?> LogBusinessUpdated =
        LoggerMessage.Define<Guid>(
            LogLevel.Information,
            new EventId(1102, nameof(LogBusinessUpdated)),
            "Updated workspace {BusinessId} settings.");

    private sealed record StoredSettings(
        string? Phone,
        string? Address,
        string? City,
        string? State,
        string? Zip,
        bool SoloMode);

    public async Task<BusinessProfileResponse> CreateAsync(
        Guid userId,
        string subject,
        string email,
        string fullName,
        CreateBusinessCommand command,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(command.Name))
        {
            throw new ArgumentException("Business name is required.", nameof(command));
        }

        var businessId = Guid.NewGuid();
        var memberId = Guid.NewGuid();
        var now = DateTimeOffset.UtcNow;
        var industry = NormalizeIndustry(command.Industry);
        var timeZone = string.IsNullOrWhiteSpace(command.TimeZone) ? "UTC" : command.TimeZone.Trim();
        var billingEmail = string.IsNullOrWhiteSpace(email) ? "billing@example.com" : email.Trim();

        var settings = new StoredSettings(
            command.Phone?.Trim(),
            command.Address?.Trim(),
            command.City?.Trim(),
            command.State?.Trim(),
            command.Zip?.Trim(),
            command.SoloMode);

        var settingsJson = JsonSerializer.Serialize(settings);

        await baseDAL.ExecutePlatformInTransactionAsync(
            "Businesses.Provision",
            async (connection, transaction, ct) =>
            {
                // Ensure platform and tenant context is set for the new workspace so RLS block predicates pass
                await BaseDAL.SetPlatformContextAsync(connection, ct, transaction).ConfigureAwait(false);
                await BaseDAL.SetTenantContextAsync(connection, businessId, ct, transaction).ConfigureAwait(false);

                // 1. Ensure user row exists in auth.Users
                const string upsertUserSql = """
                    IF NOT EXISTS (SELECT 1 FROM auth.Users WHERE Id = @UserId)
                    BEGIN
                        INSERT INTO auth.Users
                            (Id, Subject, Email, NormalizedEmail, FullName, Status, CreatedAt, UpdatedAt)
                        VALUES
                            (@UserId, @Subject, @Email, UPPER(@Email), @FullName, 'Active', SYSUTCDATETIME(), SYSUTCDATETIME());
                    END
                    """;

                await using (var userCmd = BaseDAL.BuildCommand(
                    connection, transaction, upsertUserSql, CommandType.Text,
                    [
                        new SqlParameter("@UserId", SqlDbType.UniqueIdentifier) { Value = userId },
                        new SqlParameter("@Subject", SqlDbType.NVarChar, 200) { Value = subject },
                        new SqlParameter("@Email", SqlDbType.NVarChar, 254) { Value = email },
                        new SqlParameter("@FullName", SqlDbType.NVarChar, 200) { Value = string.IsNullOrWhiteSpace(fullName) ? "Workspace Owner" : fullName },
                    ]))
                {
                    await userCmd.ExecuteNonQueryAsync(ct).ConfigureAwait(false);
                }

                // 2. Insert into platform.Businesses
                const string insertBusinessSql = """
                    INSERT INTO platform.Businesses
                        (Id, Name, Industry, Status, TimeZone, Currency, BillingEmail, Settings, CreatedAt, UpdatedAt)
                    VALUES
                        (@Id, @Name, @Industry, 'Active', @TimeZone, 'USD', @BillingEmail, @Settings, SYSUTCDATETIME(), SYSUTCDATETIME());
                    """;

                await using (var bizCmd = BaseDAL.BuildCommand(
                    connection, transaction, insertBusinessSql, CommandType.Text,
                    [
                        new SqlParameter("@Id", SqlDbType.UniqueIdentifier) { Value = businessId },
                        new SqlParameter("@Name", SqlDbType.NVarChar, 200) { Value = command.Name.Trim() },
                        new SqlParameter("@Industry", SqlDbType.VarChar, 32) { Value = industry },
                        new SqlParameter("@TimeZone", SqlDbType.NVarChar, 80) { Value = timeZone },
                        new SqlParameter("@BillingEmail", SqlDbType.NVarChar, 254) { Value = billingEmail },
                        new SqlParameter("@Settings", SqlDbType.NVarChar) { Value = settingsJson },
                    ]))
                {
                    await bizCmd.ExecuteNonQueryAsync(ct).ConfigureAwait(false);
                }

                // 3. Add Creator as Owner in app.Members
                const string insertMemberSql = """
                    INSERT INTO app.Members
                        (BusinessId, Id, UserId, RoleCode, Status, CreatedAt, UpdatedAt)
                    VALUES
                        (@BusinessId, @MemberId, @UserId, 'Owner', 'Active', SYSUTCDATETIME(), SYSUTCDATETIME());
                    """;

                await using (var memberCmd = BaseDAL.BuildCommand(
                    connection, transaction, insertMemberSql, CommandType.Text,
                    [
                        new SqlParameter("@BusinessId", SqlDbType.UniqueIdentifier) { Value = businessId },
                        new SqlParameter("@MemberId", SqlDbType.UniqueIdentifier) { Value = memberId },
                        new SqlParameter("@UserId", SqlDbType.UniqueIdentifier) { Value = userId },
                    ]))
                {
                    await memberCmd.ExecuteNonQueryAsync(ct).ConfigureAwait(false);
                }

                // 4. Initial trial subscription if published plan exists
                const string seedSubscriptionSql = """
                    DECLARE @PlanId uniqueidentifier;
                    SELECT TOP 1 @PlanId = Id
                    FROM platform.Plans
                    WHERE IsPublished = 1
                    ORDER BY Price ASC;

                    IF @PlanId IS NOT NULL
                    BEGIN
                        INSERT INTO app.Subscriptions
                            (BusinessId, Id, PlanId, Status, TrialEndsAt, PeriodStartsAt, PeriodEndsAt, IsCurrent, CreatedAt, UpdatedAt)
                        VALUES
                            (@BusinessId, NEWID(), @PlanId, 'Trialing', DATEADD(day, 14, SYSUTCDATETIME()), SYSUTCDATETIME(), DATEADD(day, 30, SYSUTCDATETIME()), 1, SYSUTCDATETIME(), SYSUTCDATETIME());
                    END
                    """;

                await using (var subCmd = BaseDAL.BuildCommand(
                    connection, transaction, seedSubscriptionSql, CommandType.Text,
                    [
                        new SqlParameter("@BusinessId", SqlDbType.UniqueIdentifier) { Value = businessId },
                    ]))
                {
                    await subCmd.ExecuteNonQueryAsync(ct).ConfigureAwait(false);
                }

                return true;
            },
            IsolationLevel.ReadCommitted,
            cancellationToken);

        LogBusinessCreated(logger, businessId, command.Name, null);

        return new BusinessProfileResponse(
            businessId,
            command.Name.Trim(),
            industry,
            "Active",
            timeZone,
            "USD",
            billingEmail,
            settings.Phone,
            settings.Address,
            settings.City,
            settings.State,
            settings.Zip,
            settings.SoloMode,
            now);
    }

    public async Task<BusinessProfileResponse?> GetAsync(
        Guid businessId,
        CancellationToken cancellationToken)
    {
        const string sql = """
            SELECT
                b.Id,
                b.Name,
                b.Industry,
                b.Status,
                b.TimeZone,
                b.Currency,
                b.BillingEmail,
                b.Settings,
                b.CreatedAt
            FROM platform.Businesses AS b
            WHERE b.Id = @BusinessId;
            """;

        return await baseDAL.ExecuteSingleAsync(
            businessId,
            "Businesses.Get",
            sql,
            reader => MapProfile(reader),
            [new SqlParameter("@BusinessId", SqlDbType.UniqueIdentifier) { Value = businessId }],
            cancellationToken);
    }

    public async Task<BusinessProfileResponse?> UpdateAsync(
        Guid businessId,
        UpdateBusinessCommand command,
        CancellationToken cancellationToken)
    {
        var existing = await GetAsync(businessId, cancellationToken);
        if (existing is null)
        {
            return null;
        }

        var updatedName = string.IsNullOrWhiteSpace(command.Name) ? existing.Name : command.Name.Trim();
        var updatedIndustry = string.IsNullOrWhiteSpace(command.Industry) ? existing.Industry : NormalizeIndustry(command.Industry);
        var updatedTimeZone = string.IsNullOrWhiteSpace(command.TimeZone) ? existing.TimeZone : command.TimeZone.Trim();
        var updatedCurrency = string.IsNullOrWhiteSpace(command.Currency) ? existing.Currency : command.Currency.Trim();

        var updatedSettings = new StoredSettings(
            command.Phone ?? existing.Phone,
            command.Address ?? existing.Address,
            command.City ?? existing.City,
            command.State ?? existing.State,
            command.Zip ?? existing.Zip,
            existing.SoloMode);

        var settingsJson = JsonSerializer.Serialize(updatedSettings);

        const string sql = """
            UPDATE platform.Businesses
            SET
                Name = @Name,
                Industry = @Industry,
                TimeZone = @TimeZone,
                Currency = @Currency,
                Settings = @Settings,
                UpdatedAt = SYSUTCDATETIME()
            WHERE Id = @BusinessId;
            """;

        await baseDAL.ExecuteNonQueryAsync(
            businessId,
            "Businesses.Update",
            sql,
            [
                new SqlParameter("@BusinessId", SqlDbType.UniqueIdentifier) { Value = businessId },
                new SqlParameter("@Name", SqlDbType.NVarChar, 200) { Value = updatedName },
                new SqlParameter("@Industry", SqlDbType.VarChar, 32) { Value = updatedIndustry },
                new SqlParameter("@TimeZone", SqlDbType.NVarChar, 80) { Value = updatedTimeZone },
                new SqlParameter("@Currency", SqlDbType.Char, 3) { Value = updatedCurrency },
                new SqlParameter("@Settings", SqlDbType.NVarChar) { Value = settingsJson },
            ],
            cancellationToken);

        LogBusinessUpdated(logger, businessId, null);

        return new BusinessProfileResponse(
            businessId,
            updatedName,
            updatedIndustry,
            existing.Status,
            updatedTimeZone,
            updatedCurrency,
            existing.BillingEmail,
            updatedSettings.Phone,
            updatedSettings.Address,
            updatedSettings.City,
            updatedSettings.State,
            updatedSettings.Zip,
            updatedSettings.SoloMode,
            existing.CreatedAt);
    }

    public async Task<WorkspaceSummaryResponse?> GetWorkspaceAsync(
        Guid businessId,
        Guid userId,
        CancellationToken cancellationToken)
    {
        var business = await GetAsync(businessId, cancellationToken);
        if (business is null)
        {
            return null;
        }

        const string memberSql = """
            SELECT
                m.Id AS MemberId,
                m.RoleCode,
                rp.PermissionCode
            FROM app.Members AS m
            LEFT JOIN auth.RolePermissions AS rp ON rp.RoleCode = m.RoleCode
            WHERE m.BusinessId = @BusinessId AND m.UserId = @UserId AND m.Status = 'Active';
            """;

        var rows = await baseDAL.ExecuteQueryAsync(
            businessId,
            "Businesses.GetMemberWorkspace",
            memberSql,
            reader => new
            {
                MemberId = reader.GetGuid(reader.GetOrdinal("MemberId")),
                RoleCode = reader.GetString(reader.GetOrdinal("RoleCode")),
                PermissionCode = reader.IsDBNull(reader.GetOrdinal("PermissionCode")) ? null : reader.GetString(reader.GetOrdinal("PermissionCode"))
            },
            [
                new SqlParameter("@BusinessId", SqlDbType.UniqueIdentifier) { Value = businessId },
                new SqlParameter("@UserId", SqlDbType.UniqueIdentifier) { Value = userId },
            ],
            cancellationToken);

        if (rows.Count == 0)
        {
            return null;
        }

        var memberId = rows[0].MemberId;
        var role = rows[0].RoleCode;
        var permissions = rows.Where(r => !string.IsNullOrEmpty(r.PermissionCode)).Select(r => r.PermissionCode!).Distinct().OrderBy(p => p).ToArray();

        return new WorkspaceSummaryResponse(
            businessId,
            business.Name,
            memberId,
            userId,
            role,
            permissions,
            business);
    }

    private static BusinessProfileResponse MapProfile(SqlDataReader reader)
    {
        var id = reader.GetGuid(reader.GetOrdinal("Id"));
        var name = reader.GetString(reader.GetOrdinal("Name"));
        var industry = reader.GetString(reader.GetOrdinal("Industry"));
        var status = reader.GetString(reader.GetOrdinal("Status"));
        var timeZone = reader.GetString(reader.GetOrdinal("TimeZone"));
        var currency = reader.GetString(reader.GetOrdinal("Currency"));
        var billingEmail = reader.GetString(reader.GetOrdinal("BillingEmail"));
        var createdAt = reader.GetDateTime(reader.GetOrdinal("CreatedAt"));

        StoredSettings? settings = null;
        var settingsIndex = reader.GetOrdinal("Settings");
        if (!reader.IsDBNull(settingsIndex))
        {
            var json = reader.GetString(settingsIndex);
            try
            {
                settings = JsonSerializer.Deserialize<StoredSettings>(json);
            }
            catch
            {
                // Fallback on corrupt JSON
            }
        }

        return new BusinessProfileResponse(
            id,
            name,
            industry,
            status,
            timeZone,
            currency,
            billingEmail,
            settings?.Phone,
            settings?.Address,
            settings?.City,
            settings?.State,
            settings?.Zip,
            settings?.SoloMode ?? false,
            createdAt);
    }

    private static string NormalizeIndustry(string? input)
    {
        if (string.IsNullOrWhiteSpace(input))
        {
            return "Other";
        }

        var cleaned = input.Trim().Replace(" ", "", StringComparison.OrdinalIgnoreCase);
        return cleaned.ToLowerInvariant() switch
        {
            "plumbing" => "Plumbing",
            "autoservice" or "auto" or "automotive" => "AutoService",
            "electrical" => "Electrical",
            "hvac" => "HVAC",
            "general" or "generaltrade" => "GeneralTrade",
            "landscaping" => "Landscaping",
            "cleaning" or "cleaningservices" => "CleaningServices",
            "roofing" => "Roofing",
            _ => "Other"
        };
    }
}
