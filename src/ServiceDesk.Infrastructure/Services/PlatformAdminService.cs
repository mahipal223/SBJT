using System.Data;
using System.Globalization;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Logging;
using ServiceDesk.Application.Platform;
using ServiceDesk.Application.Security;
using ServiceDesk.Infrastructure.Data;

namespace ServiceDesk.Infrastructure.Services;

public sealed class PlatformAdminService(
    BaseDAL baseDAL,
    ILogger<PlatformAdminService> logger,
    IAdministratorResolver administratorResolver,
    IPasswordHasher? passwordHasher = null)
    : IPlatformAdminService
{
    private static readonly Action<ILogger, Guid, string, string, Exception?> LogBusinessStatusChanged =
        LoggerMessage.Define<Guid, string, string>(
            LogLevel.Information,
            new EventId(9001, nameof(LogBusinessStatusChanged)),
            "Platform admin changed business {BusinessId} status to {NewStatus}. Reason: {Reason}");

    private static readonly Action<ILogger, Guid, Exception?> LogRestoreTriggered =
        LoggerMessage.Define<Guid>(
            LogLevel.Warning,
            new EventId(9002, nameof(LogRestoreTriggered)),
            "Platform admin triggered disaster recovery restore for backup {BackupRunId}");

    // ─── Current operator ───────────────────────────────────────────────────

    public async Task<PlatformOperatorResponse?> GetCurrentOperatorAsync(
        Guid userId,
        CancellationToken cancellationToken)
    {
        var admin = await administratorResolver.ResolveAsync(userId, cancellationToken).ConfigureAwait(false);
        if (admin is null || !admin.IsActive)
        {
            return null;
        }

        var permissions = PlatformContext.GetPermissionsForRole(admin.RoleCode).ToList();
        return new PlatformOperatorResponse(
            admin.UserId,
            admin.FullName,
            admin.Email,
            admin.RoleCode,
            permissions);
    }

    // ─── Businesses ─────────────────────────────────────────────────────────

    public async Task<IReadOnlyList<PlatformBusinessSummaryResponse>> GetBusinessesAsync(
        string? search,
        string? status,
        int page,
        int pageSize,
        CancellationToken cancellationToken)
    {
        var safePageSize = Math.Clamp(pageSize, 1, 100);
        var offset = Math.Max(0, page - 1) * safePageSize;

        const string sql = """
            SELECT
                b.Id,
                b.Name,
                b.Industry,
                b.Status,
                b.TimeZone,
                b.Currency,
                b.BillingEmail,
                b.CreatedAt,
                p.Code  AS PlanCode,
                p.Name  AS PlanName,
                p.Price AS PlanPrice,
                (SELECT COUNT_BIG(*) FROM app.Members m
                 WHERE m.BusinessId = b.Id AND m.Status = 'Active') AS MemberCount,
                s.Status AS SubscriptionStatus
            FROM platform.Businesses AS b
            LEFT JOIN app.Subscriptions AS s
                ON s.BusinessId = b.Id AND s.IsCurrent = 1
            LEFT JOIN platform.Plans AS p
                ON p.Id = s.PlanId
            WHERE (@Search IS NULL OR b.Name LIKE '%' + @Search + '%' OR b.BillingEmail LIKE '%' + @Search + '%')
              AND (@Status IS NULL OR b.Status = @Status)
            ORDER BY b.CreatedAt DESC
            OFFSET @Offset ROWS FETCH NEXT @PageSize ROWS ONLY;
            """;

        return await baseDAL.ExecutePlatformQueryAsync(
            "Platform.Businesses.List",
            sql,
            MapBusiness,
            [
                NullableNVarChar("@Search", search, 200),
                NullableNVarChar("@Status", status, 32),
                Int("@Offset", offset),
                Int("@PageSize", safePageSize)
            ],
            cancellationToken).ConfigureAwait(false);
    }

    public async Task<PlatformBusinessSummaryResponse?> GetBusinessAsync(
        Guid businessId,
        CancellationToken cancellationToken)
    {
        const string sql = """
            SELECT
                b.Id, b.Name, b.Industry, b.Status, b.TimeZone, b.Currency, b.BillingEmail, b.CreatedAt,
                p.Code AS PlanCode, p.Name AS PlanName, p.Price AS PlanPrice,
                (SELECT COUNT_BIG(*) FROM app.Members m WHERE m.BusinessId = b.Id AND m.Status = 'Active') AS MemberCount,
                s.Status AS SubscriptionStatus
            FROM platform.Businesses AS b
            LEFT JOIN app.Subscriptions AS s ON s.BusinessId = b.Id AND s.IsCurrent = 1
            LEFT JOIN platform.Plans AS p ON p.Id = s.PlanId
            WHERE b.Id = @BusinessId;
            """;

        return await baseDAL.ExecutePlatformSingleAsync(
            "Platform.Businesses.Get",
            sql,
            MapBusiness,
            [UniqueIdentifier("@BusinessId", businessId)],
            cancellationToken).ConfigureAwait(false);
    }

    public async Task UpdateBusinessStatusAsync(
        Guid businessId,
        Guid actorUserId,
        UpdateBusinessStatusRequest request,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Reason))
        {
            throw new InvalidOperationException("A reason is required when changing business status.");
        }

        var allowedStatuses = new HashSet<string>(StringComparer.Ordinal)
            { "Active", "Suspended", "DeletionPending", "Closed" };

        if (!allowedStatuses.Contains(request.Status))
        {
            throw new InvalidOperationException($"Invalid status '{request.Status}'.");
        }

        const string updateSql = """
            UPDATE platform.Businesses
            SET Status = @NewStatus, UpdatedAt = SYSUTCDATETIME()
            WHERE Id = @BusinessId;
            """;

        const string auditSql = """
            INSERT INTO platform.AdminAuditEvents
                (ActorUserId, BusinessId, Action, Details)
            VALUES
                (@ActorUserId, @BusinessId, 'business.status.changed',
                 N'{"newStatus":"' + @NewStatus + N'","reason":"' + @Reason + N'"}');
            """;

        await baseDAL.ExecutePlatformInTransactionAsync(
            "Platform.Businesses.UpdateStatus",
            async (conn, tx, ct) =>
            {
                await using var cmd1 = BaseDAL.BuildCommand(conn, tx, updateSql, parameters:
                [
                    NVarChar("@NewStatus", request.Status, 32),
                    UniqueIdentifier("@BusinessId", businessId)
                ]);
                await cmd1.ExecuteNonQueryAsync(ct).ConfigureAwait(false);

                await using var cmd2 = BaseDAL.BuildCommand(conn, tx, auditSql, parameters:
                [
                    UniqueIdentifier("@ActorUserId", actorUserId),
                    UniqueIdentifier("@BusinessId", businessId),
                    NVarChar("@NewStatus", request.Status, 32),
                    NVarChar("@Reason", request.Reason, 500)
                ]);
                await cmd2.ExecuteNonQueryAsync(ct).ConfigureAwait(false);
                return true;
            },
            cancellationToken: cancellationToken).ConfigureAwait(false);

        LogBusinessStatusChanged(logger, businessId, request.Status, request.Reason, null);
    }

    // ─── Metrics ────────────────────────────────────────────────────────────

    public async Task<PlatformMetricsResponse> GetMetricsAsync(CancellationToken cancellationToken)
    {
        const string sql = """
            SELECT
                COUNT_BIG(*)                                                                   AS TotalBusinesses,
                SUM(CASE WHEN b.Status = 'Active'    THEN 1 ELSE 0 END)                       AS ActiveBusinesses,
                SUM(CASE WHEN b.Status = 'Suspended' THEN 1 ELSE 0 END)                       AS SuspendedBusinesses,
                SUM(CASE WHEN s.Status = 'Trialing'  THEN 1 ELSE 0 END)                       AS TrialBusinesses,
                ISNULL(SUM(CASE WHEN s.Status = 'Active' THEN p.Price ELSE 0 END), 0)         AS MonthlyRevenue
            FROM platform.Businesses AS b
            LEFT JOIN app.Subscriptions AS s ON s.BusinessId = b.Id AND s.IsCurrent = 1
            LEFT JOIN platform.Plans AS p ON p.Id = s.PlanId;
            """;

        const string planDistSql = """
            SELECT p.Name, COUNT_BIG(*) AS Cnt,
                   CAST(COUNT_BIG(*) * 100.0 / NULLIF((SELECT COUNT_BIG(*) FROM app.Subscriptions WHERE IsCurrent = 1), 0) AS decimal(5,1)) AS Pct
            FROM app.Subscriptions s
            JOIN platform.Plans p ON p.Id = s.PlanId
            WHERE s.IsCurrent = 1
            GROUP BY p.Name
            ORDER BY Cnt DESC;
            """;

        const string industryDistSql = """
            SELECT b.Industry, COUNT_BIG(*) AS Cnt,
                   CAST(COUNT_BIG(*) * 100.0 / NULLIF((SELECT COUNT_BIG(*) FROM platform.Businesses), 0) AS decimal(5,1)) AS Pct
            FROM platform.Businesses b
            GROUP BY b.Industry
            ORDER BY Cnt DESC;
            """;

        var rows = await baseDAL.ExecutePlatformQueryAsync(
            "Platform.Metrics.Aggregate",
            sql,
            reader => new
            {
                Total = Convert.ToInt32(reader.GetValue(0), System.Globalization.CultureInfo.InvariantCulture),
                Active = reader.IsDBNull(1) ? 0 : Convert.ToInt32(reader.GetValue(1), System.Globalization.CultureInfo.InvariantCulture),
                Suspended = reader.IsDBNull(2) ? 0 : Convert.ToInt32(reader.GetValue(2), System.Globalization.CultureInfo.InvariantCulture),
                Trial = reader.IsDBNull(3) ? 0 : Convert.ToInt32(reader.GetValue(3), System.Globalization.CultureInfo.InvariantCulture),
                Mrr = reader.IsDBNull(4) ? 0m : reader.GetDecimal(4)
            },
            [],
            cancellationToken).ConfigureAwait(false);

        var planDist = await baseDAL.ExecutePlatformQueryAsync(
            "Platform.Metrics.PlanDist",
            planDistSql,
            reader => new PlatformPlanDistributionItem(
                reader.GetString(0),
                Convert.ToInt32(reader.GetValue(1), System.Globalization.CultureInfo.InvariantCulture),
                reader.IsDBNull(2) ? 0m : reader.GetDecimal(2)),
            [],
            cancellationToken).ConfigureAwait(false);

        var industryDist = await baseDAL.ExecutePlatformQueryAsync(
            "Platform.Metrics.IndustryDist",
            industryDistSql,
            reader => new PlatformIndustryDistributionItem(
                reader.GetString(0),
                Convert.ToInt32(reader.GetValue(1), System.Globalization.CultureInfo.InvariantCulture),
                reader.IsDBNull(2) ? 0m : reader.GetDecimal(2)),
            [],
            cancellationToken).ConfigureAwait(false);

        var agg = rows.Count > 0 ? rows[0] : null;
        var totalBiz = agg?.Total ?? 0;
        var trialCount = agg?.Trial ?? 0;
        var activePaid = agg?.Active ?? 0;
        var converted = activePaid + trialCount;
        var conversionRate = converted == 0 ? 0m : Math.Round((decimal)activePaid / converted * 100, 1);

        return new PlatformMetricsResponse(
            totalBiz,
            activePaid,
            agg?.Suspended ?? 0,
            trialCount,
            agg?.Mrr ?? 0m,
            conversionRate,
            99.98m,
            "All systems operational",
            planDist,
            industryDist);
    }

    // ─── Plans ───────────────────────────────────────────────────────────────

    public async Task<IReadOnlyList<PlatformPlanDetailResponse>> GetPlansAsync(CancellationToken cancellationToken)
    {
        const string sql = """
            SELECT p.Id, p.Code, p.Revision, p.Name, p.BillingInterval, p.Price, p.Currency, p.IsPublished,
                   e.FeatureCode, e.Enabled, e.LimitValue, e.DisplayText
            FROM platform.Plans p
            LEFT JOIN platform.PlanEntitlements e ON p.Id = e.PlanId
            ORDER BY p.Price ASC, p.Code ASC, e.FeatureCode ASC;
            """;

        var rows = await baseDAL.ExecutePlatformQueryAsync(
            "Platform.Plans.List",
            sql,
            reader => new
            {
                Id = reader.GetGuid(0),
                Code = reader.GetString(1),
                Revision = reader.GetInt32(2),
                Name = reader.GetString(3),
                Interval = reader.GetString(4),
                Price = reader.GetDecimal(5),
                Currency = reader.GetString(6),
                IsPublished = reader.GetBoolean(7),
                FeatureCode = reader.IsDBNull(8) ? null : reader.GetString(8),
                Enabled = !reader.IsDBNull(9) && reader.GetBoolean(9),
                LimitValue = reader.IsDBNull(10) ? (long?)null : reader.GetInt64(10),
                DisplayText = reader.IsDBNull(11) ? null : reader.GetString(11)
            },
            [],
            cancellationToken).ConfigureAwait(false);

        return rows
            .GroupBy(r => r.Id)
            .Select(g =>
            {
                var first = g.First();
                var entitlements = g
                    .Where(r => r.FeatureCode is not null)
                    .Select(r => new PlatformPlanEntitlementRow(r.FeatureCode!, r.Enabled, r.LimitValue, r.DisplayText ?? ""))
                    .ToList();
                return new PlatformPlanDetailResponse(
                    first.Id, first.Code, first.Revision, first.Name,
                    first.Interval, first.Price, first.Currency, first.IsPublished,
                    entitlements);
            })
            .ToList();
    }

    public async Task<PlatformPlanDetailResponse> CreatePlanAsync(
        Guid actorUserId,
        CreatePlatformPlanRequest request,
        CancellationToken cancellationToken)
    {
        var planId = Guid.NewGuid();

        const string insertPlanSql = """
            INSERT INTO platform.Plans (Id, Code, Revision, Name, BillingInterval, Price, Currency, IsPublished)
            VALUES (@Id, @Code, 1, @Name, @Interval, @Price, @Currency, @IsPublished);
            """;

        const string insertEntitlementSql = """
            INSERT INTO platform.PlanEntitlements (PlanId, FeatureCode, Enabled, LimitValue, DisplayText)
            VALUES (@PlanId, @FeatureCode, @Enabled, @LimitValue, @DisplayText);
            """;

        const string auditSql = """
            INSERT INTO platform.AdminAuditEvents (ActorUserId, BusinessId, Action, Details)
            VALUES (@ActorUserId, NULL, 'plan.created', N'{"planCode":"' + @Code + N'","price":' + CAST(@Price AS nvarchar) + N'}');
            """;

        await baseDAL.ExecutePlatformInTransactionAsync(
            "Platform.Plans.Create",
            async (conn, tx, ct) =>
            {
                await using var cmdPlan = BaseDAL.BuildCommand(conn, tx, insertPlanSql, parameters:
                [
                    UniqueIdentifier("@Id", planId),
                    NVarChar("@Code", request.Code, 40),
                    NVarChar("@Name", request.Name, 100),
                    NVarChar("@Interval", request.BillingInterval, 32),
                    Decimal("@Price", request.Price),
                    NVarChar("@Currency", request.Currency, 3),
                    Bit("@IsPublished", request.IsPublished)
                ]);
                await cmdPlan.ExecuteNonQueryAsync(ct).ConfigureAwait(false);

                foreach (var ent in request.Entitlements)
                {
                    await using var cmdEnt = BaseDAL.BuildCommand(conn, tx, insertEntitlementSql, parameters:
                    [
                        UniqueIdentifier("@PlanId", planId),
                        NVarChar("@FeatureCode", ent.FeatureCode, 60),
                        Bit("@Enabled", ent.Enabled),
                        ent.LimitValue.HasValue ? BigInt("@LimitValue", ent.LimitValue.Value) : NullBigInt("@LimitValue"),
                        NVarChar("@DisplayText", ent.DisplayText, 200)
                    ]);
                    await cmdEnt.ExecuteNonQueryAsync(ct).ConfigureAwait(false);
                }

                await using var cmdAudit = BaseDAL.BuildCommand(conn, tx, auditSql, parameters:
                [
                    UniqueIdentifier("@ActorUserId", actorUserId),
                    NVarChar("@Code", request.Code, 40),
                    Decimal("@Price", request.Price)
                ]);
                await cmdAudit.ExecuteNonQueryAsync(ct).ConfigureAwait(false);
                return true;
            },
            cancellationToken: cancellationToken).ConfigureAwait(false);

        return new PlatformPlanDetailResponse(
            planId, request.Code, 1, request.Name, request.BillingInterval,
            request.Price, request.Currency, request.IsPublished,
            request.Entitlements);
    }

    public async Task<PlatformPlanDetailResponse> UpdatePlanAsync(
        Guid actorUserId,
        Guid planId,
        UpdatePlatformPlanRequest request,
        CancellationToken cancellationToken)
    {
        const string checkSql = "SELECT Code, Revision FROM platform.Plans WHERE Id = @Id;";
        const string updatePlanSql = """
            UPDATE platform.Plans
            SET Name = @Name,
                BillingInterval = @Interval,
                Price = @Price,
                Currency = @Currency,
                IsPublished = @IsPublished,
                Revision = Revision + 1
            WHERE Id = @Id;
            """;

        const string deleteEntitlementsSql = "DELETE FROM platform.PlanEntitlements WHERE PlanId = @PlanId;";
        const string insertEntitlementSql = """
            INSERT INTO platform.PlanEntitlements (PlanId, FeatureCode, Enabled, LimitValue, DisplayText)
            VALUES (@PlanId, @FeatureCode, @Enabled, @LimitValue, @DisplayText);
            """;

        const string auditSql = """
            INSERT INTO platform.AdminAuditEvents (ActorUserId, BusinessId, Action, Details)
            VALUES (@ActorUserId, NULL, 'plan.updated', N'{"planId":"' + CAST(@Id AS nvarchar(36)) + N'","price":' + CAST(@Price AS nvarchar) + N'}');
            """;

        var (code, newRev) = await baseDAL.ExecutePlatformInTransactionAsync(
            "Platform.Plans.Update",
            async (conn, tx, ct) =>
            {
                string planCode;
                int currentRev;
                await using (var cmdCheck = BaseDAL.BuildCommand(conn, tx, checkSql, parameters: [UniqueIdentifier("@Id", planId)]))
                await using (var reader = await cmdCheck.ExecuteReaderAsync(ct).ConfigureAwait(false))
                {
                    if (!await reader.ReadAsync(ct).ConfigureAwait(false))
                    {
                        throw new InvalidOperationException("The specified plan does not exist.");
                    }
                    planCode = reader.GetString(0);
                    currentRev = reader.GetInt32(1);
                }

                await using (var cmdPlan = BaseDAL.BuildCommand(conn, tx, updatePlanSql, parameters:
                [
                    UniqueIdentifier("@Id", planId),
                    NVarChar("@Name", request.Name, 100),
                    NVarChar("@Interval", request.BillingInterval, 32),
                    Decimal("@Price", request.Price),
                    NVarChar("@Currency", request.Currency, 3),
                    Bit("@IsPublished", request.IsPublished)
                ]))
                {
                    await cmdPlan.ExecuteNonQueryAsync(ct).ConfigureAwait(false);
                }

                await using (var cmdDel = BaseDAL.BuildCommand(conn, tx, deleteEntitlementsSql, parameters: [UniqueIdentifier("@PlanId", planId)]))
                {
                    await cmdDel.ExecuteNonQueryAsync(ct).ConfigureAwait(false);
                }

                foreach (var ent in request.Entitlements)
                {
                    await using var cmdEnt = BaseDAL.BuildCommand(conn, tx, insertEntitlementSql, parameters:
                    [
                        UniqueIdentifier("@PlanId", planId),
                        NVarChar("@FeatureCode", ent.FeatureCode, 60),
                        Bit("@Enabled", ent.Enabled),
                        ent.LimitValue.HasValue ? BigInt("@LimitValue", ent.LimitValue.Value) : NullBigInt("@LimitValue"),
                        NVarChar("@DisplayText", ent.DisplayText, 200)
                    ]);
                    await cmdEnt.ExecuteNonQueryAsync(ct).ConfigureAwait(false);
                }

                await using (var cmdAudit = BaseDAL.BuildCommand(conn, tx, auditSql, parameters:
                [
                    UniqueIdentifier("@ActorUserId", actorUserId),
                    UniqueIdentifier("@Id", planId),
                    Decimal("@Price", request.Price)
                ]))
                {
                    await cmdAudit.ExecuteNonQueryAsync(ct).ConfigureAwait(false);
                }

                return (planCode, currentRev + 1);
            },
            IsolationLevel.ReadCommitted,
            cancellationToken: cancellationToken).ConfigureAwait(false);

        return new PlatformPlanDetailResponse(
            planId, code, newRev, request.Name, request.BillingInterval,
            request.Price, request.Currency, request.IsPublished,
            request.Entitlements);
    }

    public async Task<PlatformPlanDetailResponse> TogglePlanPublishAsync(
        Guid actorUserId,
        Guid planId,
        bool isPublished,
        CancellationToken cancellationToken)
    {
        const string sql = """
            UPDATE platform.Plans
            SET IsPublished = @IsPublished
            WHERE Id = @Id;

            INSERT INTO platform.AdminAuditEvents (ActorUserId, BusinessId, Action, Details)
            VALUES (@ActorUserId, NULL, CASE WHEN @IsPublished = 1 THEN 'plan.published' ELSE 'plan.unpublished' END,
                    N'{"planId":"' + CAST(@Id AS nvarchar(36)) + N'"}');
            """;

        await baseDAL.ExecutePlatformInTransactionAsync(
            "Platform.Plans.TogglePublish",
            async (conn, tx, ct) =>
            {
                await using var cmd = BaseDAL.BuildCommand(conn, tx, sql, parameters:
                [
                    UniqueIdentifier("@Id", planId),
                    Bit("@IsPublished", isPublished),
                    UniqueIdentifier("@ActorUserId", actorUserId)
                ]);
                var rows = await cmd.ExecuteNonQueryAsync(ct).ConfigureAwait(false);
                if (rows == 0)
                {
                    throw new InvalidOperationException("Plan not found.");
                }
                return true;
            },
            IsolationLevel.ReadCommitted,
            cancellationToken: cancellationToken).ConfigureAwait(false);

        var allPlans = await GetPlansAsync(cancellationToken).ConfigureAwait(false);
        var plan = allPlans.FirstOrDefault(p => p.Id == planId);
        if (plan is null)
        {
            throw new InvalidOperationException("Plan not found after update.");
        }
        return plan;
    }

    public async Task DeletePlanAsync(
        Guid actorUserId,
        Guid planId,
        CancellationToken cancellationToken)
    {
        const string checkSubSql = """
            SELECT COUNT(*)
            FROM app.Subscriptions
            WHERE PlanId = @PlanId AND IsCurrent = 1;
            """;

        const string deleteEntSql = "DELETE FROM platform.PlanEntitlements WHERE PlanId = @PlanId;";
        const string deletePlanSql = "DELETE FROM platform.Plans WHERE Id = @PlanId;";
        const string auditSql = """
            INSERT INTO platform.AdminAuditEvents (ActorUserId, BusinessId, Action, Details)
            VALUES (@ActorUserId, NULL, 'plan.deleted', N'{"planId":"' + CAST(@PlanId AS nvarchar(36)) + N'"}');
            """;

        await baseDAL.ExecutePlatformInTransactionAsync(
            "Platform.Plans.Delete",
            async (conn, tx, ct) =>
            {
                await using (var cmdCheck = BaseDAL.BuildCommand(conn, tx, checkSubSql, parameters: [UniqueIdentifier("@PlanId", planId)]))
                {
                    var count = Convert.ToInt32(await cmdCheck.ExecuteScalarAsync(ct).ConfigureAwait(false), System.Globalization.CultureInfo.InvariantCulture);
                    if (count > 0)
                    {
                        throw new InvalidOperationException("Cannot delete plan: active tenant workspaces are currently subscribed to this plan. Unpublish the plan instead to prevent new signups.");
                    }
                }

                await using (var cmdEnt = BaseDAL.BuildCommand(conn, tx, deleteEntSql, parameters: [UniqueIdentifier("@PlanId", planId)]))
                {
                    await cmdEnt.ExecuteNonQueryAsync(ct).ConfigureAwait(false);
                }

                await using (var cmdPlan = BaseDAL.BuildCommand(conn, tx, deletePlanSql, parameters: [UniqueIdentifier("@PlanId", planId)]))
                {
                    var rows = await cmdPlan.ExecuteNonQueryAsync(ct).ConfigureAwait(false);
                    if (rows == 0)
                    {
                        throw new InvalidOperationException("Plan not found.");
                    }
                }

                await using (var cmdAudit = BaseDAL.BuildCommand(conn, tx, auditSql, parameters:
                [
                    UniqueIdentifier("@ActorUserId", actorUserId),
                    UniqueIdentifier("@PlanId", planId)
                ]))
                {
                    await cmdAudit.ExecuteNonQueryAsync(ct).ConfigureAwait(false);
                }

                return true;
            },
            IsolationLevel.ReadCommitted,
            cancellationToken: cancellationToken).ConfigureAwait(false);
    }

    // ─── Backup & Restore ────────────────────────────────────────────────────

    public async Task<IReadOnlyList<BackupRunResponse>> GetBackupRunsAsync(
        int limit,
        CancellationToken cancellationToken)
    {
        var safeLimit = Math.Clamp(limit, 1, 100);
        const string sql = """
            SELECT TOP (@Limit) Id, ProviderReference, Status, StartedAt, CompletedAt
            FROM platform.BackupRuns
            ORDER BY StartedAt DESC;
            """;

        return await baseDAL.ExecutePlatformQueryAsync(
            "Platform.BackupRuns.List",
            sql,
            reader => new BackupRunResponse(
                reader.GetGuid(0),
                reader.GetString(1),
                reader.GetString(2),
                new DateTimeOffset(DateTime.SpecifyKind(reader.GetDateTime(3), DateTimeKind.Utc)),
                reader.IsDBNull(4) ? null : new DateTimeOffset(DateTime.SpecifyKind(reader.GetDateTime(4), DateTimeKind.Utc))),
            [Int("@Limit", safeLimit)],
            cancellationToken).ConfigureAwait(false);
    }

    public async Task<RestoreRunResponse> CreateRestoreRunAsync(
        Guid actorUserId,
        CreateRestoreRequest request,
        CancellationToken cancellationToken)
    {
        var restoreId = Guid.NewGuid();
        var startedAt = DateTime.UtcNow;

        const string sql = """
            INSERT INTO platform.RestoreRuns (Id, BackupRunId, RequestedByUserId, TargetEnvironment, Status, StartedAt)
            VALUES (@Id, @BackupRunId, @RequestedByUserId, @TargetEnvironment, 'Running', @StartedAt);
            """;

        const string auditSql = """
            INSERT INTO platform.AdminAuditEvents (ActorUserId, BusinessId, Action, Details)
            VALUES (@ActorUserId, NULL, 'restore.triggered',
                    N'{"backupRunId":"' + CAST(@BackupRunId AS nvarchar(36)) + N'","target":"' + @Target + N'"}');
            """;

        await baseDAL.ExecutePlatformInTransactionAsync(
            "Platform.RestoreRuns.Create",
            async (conn, tx, ct) =>
            {
                await using var cmd1 = BaseDAL.BuildCommand(conn, tx, sql, parameters:
                [
                    UniqueIdentifier("@Id", restoreId),
                    UniqueIdentifier("@BackupRunId", request.BackupRunId),
                    UniqueIdentifier("@RequestedByUserId", actorUserId),
                    NVarChar("@TargetEnvironment", request.TargetEnvironment, 100),
                    DateTime2("@StartedAt", startedAt)
                ]);
                await cmd1.ExecuteNonQueryAsync(ct).ConfigureAwait(false);

                await using var cmd2 = BaseDAL.BuildCommand(conn, tx, auditSql, parameters:
                [
                    UniqueIdentifier("@ActorUserId", actorUserId),
                    UniqueIdentifier("@BackupRunId", request.BackupRunId),
                    NVarChar("@Target", request.TargetEnvironment, 100)
                ]);
                await cmd2.ExecuteNonQueryAsync(ct).ConfigureAwait(false);
                return true;
            },
            cancellationToken: cancellationToken).ConfigureAwait(false);

        LogRestoreTriggered(logger, request.BackupRunId, null);

        return new RestoreRunResponse(
            restoreId, request.BackupRunId, actorUserId,
            request.TargetEnvironment, "Running",
            new DateTimeOffset(startedAt, TimeSpan.Zero), null);
    }

    public async Task<RestoreRunResponse?> GetRestoreRunAsync(Guid restoreId, CancellationToken cancellationToken)
    {
        const string sql = """
            SELECT Id, BackupRunId, RequestedByUserId, TargetEnvironment, Status, StartedAt, CompletedAt
            FROM platform.RestoreRuns
            WHERE Id = @RestoreId;
            """;

        return await baseDAL.ExecutePlatformSingleAsync(
            "Platform.RestoreRuns.Get",
            sql,
            reader => new RestoreRunResponse(
                reader.GetGuid(0),
                reader.GetGuid(1),
                reader.GetGuid(2),
                reader.GetString(3),
                reader.GetString(4),
                new DateTimeOffset(DateTime.SpecifyKind(reader.GetDateTime(5), DateTimeKind.Utc)),
                reader.IsDBNull(6) ? null : new DateTimeOffset(DateTime.SpecifyKind(reader.GetDateTime(6), DateTimeKind.Utc))),
            [UniqueIdentifier("@RestoreId", restoreId)],
            cancellationToken).ConfigureAwait(false);
    }

    // ─── Platform Audit Events ────────────────────────────────────────────────

    public async Task<IReadOnlyList<PlatformAdminAuditEventResponse>> GetAdminAuditEventsAsync(
        int limit,
        CancellationToken cancellationToken)
    {
        var safeLimit = Math.Clamp(limit, 1, 200);
        const string sql = """
            SELECT TOP (@Limit)
                ae.Id, ae.ActorUserId, ae.BusinessId,
                b.Name AS BusinessName,
                ae.Action, ae.Details, ae.CreatedAt
            FROM platform.AdminAuditEvents ae
            LEFT JOIN platform.Businesses b ON b.Id = ae.BusinessId
            ORDER BY ae.CreatedAt DESC;
            """;

        return await baseDAL.ExecutePlatformQueryAsync(
            "Platform.AdminAudit.List",
            sql,
            reader => new PlatformAdminAuditEventResponse(
                reader.GetGuid(0),
                reader.GetGuid(1),
                reader.IsDBNull(2) ? null : reader.GetGuid(2),
                reader.IsDBNull(3) ? null : reader.GetString(3),
                reader.GetString(4),
                reader.IsDBNull(5) ? null : reader.GetString(5),
                new DateTimeOffset(DateTime.SpecifyKind(reader.GetDateTime(6), DateTimeKind.Utc))),
            [Int("@Limit", safeLimit)],
            cancellationToken).ConfigureAwait(false);
    }

    // ─── Support Grants ───────────────────────────────────────────────────────

    public async Task<IReadOnlyList<SupportGrantResponse>> GetSupportGrantsAsync(
        Guid businessId,
        CancellationToken cancellationToken)
    {
        const string sql = """
            SELECT Id, BusinessId, AdminUserId, Scope, ExpiresAt, RevokedAt,
                   CASE WHEN RevokedAt IS NULL AND ExpiresAt > SYSUTCDATETIME() THEN 1 ELSE 0 END AS IsActive,
                   CreatedAt
            FROM app.SupportAccessGrants
            WHERE BusinessId = @BusinessId
            ORDER BY CreatedAt DESC;
            """;

        return await baseDAL.ExecuteQueryAsync(
            businessId,
            "Platform.SupportGrants.List",
            sql,
            reader => new SupportGrantResponse(
                reader.GetGuid(0),
                reader.GetGuid(1),
                reader.GetGuid(2),
                reader.GetString(3),
                new DateTimeOffset(DateTime.SpecifyKind(reader.GetDateTime(4), DateTimeKind.Utc)),
                reader.IsDBNull(5) ? null : new DateTimeOffset(DateTime.SpecifyKind(reader.GetDateTime(5), DateTimeKind.Utc)),
                reader.GetBoolean(6),
                new DateTimeOffset(DateTime.SpecifyKind(reader.GetDateTime(7), DateTimeKind.Utc))),
            [UniqueIdentifier("@BusinessId", businessId)],
            cancellationToken).ConfigureAwait(false);
    }

    public async Task<SupportGrantResponse> CreateSupportGrantAsync(
        Guid businessId,
        Guid actorUserId,
        Guid approvedByMemberId,
        CreateSupportGrantRequest request,
        CancellationToken cancellationToken)
    {
        var grantId = Guid.NewGuid();
        var now = DateTime.UtcNow;
        var expiresAt = now.AddHours(Math.Clamp(request.DurationHours, 1, 72));

        const string sql = """
            INSERT INTO app.SupportAccessGrants
                (BusinessId, Id, AdminUserId, ApprovedByMemberId, Scope, ExpiresAt)
            VALUES
                (@BusinessId, @Id, @AdminUserId, @ApprovedByMemberId, 'ReadOnly', @ExpiresAt);
            """;

        await baseDAL.ExecuteNonQueryAsync(
            businessId,
            "Platform.SupportGrants.Create",
            sql,
            [
                UniqueIdentifier("@BusinessId", businessId),
                UniqueIdentifier("@Id", grantId),
                UniqueIdentifier("@AdminUserId", request.AdminUserId),
                UniqueIdentifier("@ApprovedByMemberId", approvedByMemberId),
                DateTime2("@ExpiresAt", expiresAt)
            ],
            cancellationToken).ConfigureAwait(false);

        return new SupportGrantResponse(
            grantId, businessId, request.AdminUserId, "ReadOnly",
            new DateTimeOffset(expiresAt, TimeSpan.Zero), null, true,
            new DateTimeOffset(now, TimeSpan.Zero));
    }

    public async Task RevokeSupportGrantAsync(
        Guid businessId,
        Guid grantId,
        Guid actorUserId,
        CancellationToken cancellationToken)
    {
        const string sql = """
            UPDATE app.SupportAccessGrants
            SET RevokedAt = SYSUTCDATETIME(), UpdatedAt = SYSUTCDATETIME()
            WHERE BusinessId = @BusinessId AND Id = @GrantId AND RevokedAt IS NULL;
            """;

        await baseDAL.ExecuteNonQueryAsync(
            businessId,
            "Platform.SupportGrants.Revoke",
            sql,
            [
                UniqueIdentifier("@BusinessId", businessId),
                UniqueIdentifier("@GrantId", grantId)
            ],
            cancellationToken).ConfigureAwait(false);
    }

    // ─── Platform Users & Custom Permissions ─────────────────────────────────

    public async Task<IReadOnlyList<PlatformUserDetailResponse>> GetPlatformUsersAsync(
        CancellationToken cancellationToken)
    {
        const string sql = """
            IF NOT EXISTS (SELECT 1 FROM sys.tables t JOIN sys.schemas s ON t.schema_id = s.schema_id WHERE s.name = 'platform' AND t.name = 'AdministratorPermissions')
            BEGIN
                CREATE TABLE platform.AdministratorPermissions (
                    UserId uniqueidentifier NOT NULL,
                    PermissionCode varchar(80) NOT NULL,
                    PRIMARY KEY (UserId, PermissionCode),
                    FOREIGN KEY (UserId) REFERENCES platform.Administrators(UserId) ON DELETE CASCADE
                );
            END;

            SELECT
                a.UserId,
                u.FullName,
                u.Email,
                a.RoleCode,
                a.IsActive,
                u.CreatedAt
            FROM platform.Administrators AS a
            INNER JOIN auth.Users AS u ON u.Id = a.UserId
            ORDER BY u.FullName ASC;
            """;

        var users = await baseDAL.ExecutePlatformQueryAsync(
            "Platform.Users.List",
            sql,
            reader => (
                UserId: reader.GetGuid(0),
                FullName: reader.GetString(1),
                Email: reader.GetString(2),
                RoleCode: reader.GetString(3),
                IsActive: reader.GetBoolean(4),
                CreatedAt: (DateTimeOffset?)new DateTimeOffset(DateTime.SpecifyKind(reader.GetDateTime(5), DateTimeKind.Utc))
            ),
            null,
            cancellationToken).ConfigureAwait(false);

        const string permSql = """
            SELECT UserId, PermissionCode
            FROM platform.AdministratorPermissions;
            """;

        var allPerms = await baseDAL.ExecutePlatformQueryAsync(
            "Platform.Users.AllPermissions",
            permSql,
            reader => (UserId: reader.GetGuid(0), PermissionCode: reader.GetString(1)),
            null,
            cancellationToken).ConfigureAwait(false);

        var permsByUser = allPerms
            .GroupBy(p => p.UserId)
            .ToDictionary(g => g.Key, g => g.Select(p => p.PermissionCode).ToList());

        var result = new List<PlatformUserDetailResponse>();
        foreach (var u in users)
        {
            IReadOnlyList<string> pageAccess;
            if (permsByUser.TryGetValue(u.UserId, out var customList) && customList.Count > 0)
            {
                pageAccess = customList;
            }
            else
            {
                // Fall back to role-based defaults if not explicitly customized
                pageAccess = u.RoleCode switch
                {
                    "OperationsAdmin" => ["overview", "workspaces", "plans", "backups", "audit", "smtp", "security", "users"],
                    "BillingAdmin" => ["overview", "workspaces", "plans"],
                    _ => ["overview", "workspaces", "security"]
                };
            }

            result.Add(new PlatformUserDetailResponse(
                u.UserId,
                u.FullName,
                u.Email,
                u.RoleCode,
                u.IsActive,
                pageAccess,
                u.CreatedAt));
        }

        return result;
    }

    public async Task<PlatformUserDetailResponse> CreatePlatformUserAsync(
        Guid actorUserId,
        CreatePlatformUserRequest request,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.FullName))
            throw new ArgumentException("Full name is required.");
        if (string.IsNullOrWhiteSpace(request.Email) || !request.Email.Contains('@'))
            throw new ArgumentException("A valid email address is required.");

        var cleanEmail = request.Email.Trim();
        var normalizedEmail = cleanEmail.ToUpperInvariant();
        var normalizedPages = (request.PageAccess ?? [])
            .Select(p => p.Trim().ToLowerInvariant())
            .Distinct()
            .ToList();

        if (normalizedPages.Count == 0)
        {
            normalizedPages = ["overview"];
        }

        return await baseDAL.ExecutePlatformInTransactionAsync(
            "Platform.Users.Create",
            async (connection, transaction, ct) =>
            {
                const string ensureTableSql = """
                    IF NOT EXISTS (SELECT 1 FROM sys.tables t JOIN sys.schemas s ON t.schema_id = s.schema_id WHERE s.name = 'platform' AND t.name = 'AdministratorPermissions')
                    BEGIN
                        CREATE TABLE platform.AdministratorPermissions (
                            UserId uniqueidentifier NOT NULL,
                            PermissionCode varchar(80) NOT NULL,
                            PRIMARY KEY (UserId, PermissionCode),
                            FOREIGN KEY (UserId) REFERENCES platform.Administrators(UserId) ON DELETE CASCADE
                        );
                    END;
                    """;

                using (var ensureCmd = connection.CreateCommand())
                {
                    ensureCmd.Transaction = transaction;
                    ensureCmd.CommandText = ensureTableSql;
                    await ensureCmd.ExecuteNonQueryAsync(ct).ConfigureAwait(false);
                }

                // Check if user already exists in auth.Users
                const string findUserSql = """
                    SELECT Id FROM auth.Users WHERE NormalizedEmail = @NormalizedEmail;
                    """;

                Guid userId;
                using (var cmd = connection.CreateCommand())
                {
                    cmd.Transaction = transaction;
                    cmd.CommandText = findUserSql;
                    cmd.Parameters.Add(new SqlParameter("@NormalizedEmail", SqlDbType.NVarChar, 254) { Value = normalizedEmail });
                    var existingId = await cmd.ExecuteScalarAsync(ct).ConfigureAwait(false);
                    if (existingId is not null && existingId != DBNull.Value)
                    {
                        userId = (Guid)existingId;
                    }
                    else
                    {
                        userId = Guid.NewGuid();
                        string? hash = null;
                        string? salt = null;
                        if (!string.IsNullOrWhiteSpace(request.InitialPassword) && passwordHasher is not null)
                        {
                            var res = passwordHasher.HashPassword(request.InitialPassword);
                            hash = res.Hash;
                            salt = res.Salt;
                        }

                        const string insertUserSql = """
                            INSERT INTO auth.Users (Id, Subject, Email, NormalizedEmail, FullName, PasswordHash, PasswordSalt, CreatedAt, UpdatedAt)
                            VALUES (@Id, @Subject, @Email, @NormalizedEmail, @FullName, @PasswordHash, @PasswordSalt, SYSUTCDATETIME(), SYSUTCDATETIME());
                            """;

                        using var insertCmd = connection.CreateCommand();
                        insertCmd.Transaction = transaction;
                        insertCmd.CommandText = insertUserSql;
                        insertCmd.Parameters.Add(new SqlParameter("@Id", SqlDbType.UniqueIdentifier) { Value = userId });
                        insertCmd.Parameters.Add(new SqlParameter("@Subject", SqlDbType.NVarChar, 200) { Value = $"platform-user-{userId:N}" });
                        insertCmd.Parameters.Add(new SqlParameter("@Email", SqlDbType.NVarChar, 254) { Value = cleanEmail });
                        insertCmd.Parameters.Add(new SqlParameter("@NormalizedEmail", SqlDbType.NVarChar, 254) { Value = normalizedEmail });
                        insertCmd.Parameters.Add(new SqlParameter("@FullName", SqlDbType.NVarChar, 200) { Value = request.FullName.Trim() });
                        insertCmd.Parameters.Add(new SqlParameter("@PasswordHash", SqlDbType.NVarChar, 500) { Value = (object?)hash ?? DBNull.Value });
                        insertCmd.Parameters.Add(new SqlParameter("@PasswordSalt", SqlDbType.NVarChar, 200) { Value = (object?)salt ?? DBNull.Value });
                        await insertCmd.ExecuteNonQueryAsync(ct).ConfigureAwait(false);
                    }
                }

                // Check if already in platform.Administrators
                const string checkAdminSql = "SELECT 1 FROM platform.Administrators WHERE UserId = @UserId;";
                using (var checkCmd = connection.CreateCommand())
                {
                    checkCmd.Transaction = transaction;
                    checkCmd.CommandText = checkAdminSql;
                    checkCmd.Parameters.Add(new SqlParameter("@UserId", SqlDbType.UniqueIdentifier) { Value = userId });
                    var exists = await checkCmd.ExecuteScalarAsync(ct).ConfigureAwait(false);
                    if (exists is not null && exists != DBNull.Value)
                    {
                        throw new InvalidOperationException("This user is already registered as a platform user.");
                    }
                }

                var roleCode = normalizedPages.Contains("users") ? "OperationsAdmin" : "Support";

                const string insertAdminSql = """
                    INSERT INTO platform.Administrators (UserId, RoleCode, IsActive)
                    VALUES (@UserId, @RoleCode, 1);
                    """;

                using (var adminCmd = connection.CreateCommand())
                {
                    adminCmd.Transaction = transaction;
                    adminCmd.CommandText = insertAdminSql;
                    adminCmd.Parameters.Add(new SqlParameter("@UserId", SqlDbType.UniqueIdentifier) { Value = userId });
                    adminCmd.Parameters.Add(new SqlParameter("@RoleCode", SqlDbType.VarChar, 32) { Value = roleCode });
                    await adminCmd.ExecuteNonQueryAsync(ct).ConfigureAwait(false);
                }

                // Insert into platform.AdministratorPermissions
                foreach (var page in normalizedPages)
                {
                    const string insertPermSql = """
                        INSERT INTO platform.AdministratorPermissions (UserId, PermissionCode)
                        VALUES (@UserId, @PermissionCode);
                        """;

                    using var permCmd = connection.CreateCommand();
                    permCmd.Transaction = transaction;
                    permCmd.CommandText = insertPermSql;
                    permCmd.Parameters.Add(new SqlParameter("@UserId", SqlDbType.UniqueIdentifier) { Value = userId });
                    permCmd.Parameters.Add(new SqlParameter("@PermissionCode", SqlDbType.VarChar, 80) { Value = page });
                    await permCmd.ExecuteNonQueryAsync(ct).ConfigureAwait(false);
                }

                // Audit event
                const string auditSql = """
                    INSERT INTO platform.AdminAuditEvents (ActorUserId, BusinessId, Action, Details, CreatedAt)
                    VALUES (@ActorUserId, NULL, 'PlatformUserCreated', @Details, SYSUTCDATETIME());
                    """;

                using (var auditCmd = connection.CreateCommand())
                {
                    auditCmd.Transaction = transaction;
                    auditCmd.CommandText = auditSql;
                    auditCmd.Parameters.Add(new SqlParameter("@ActorUserId", SqlDbType.UniqueIdentifier) { Value = actorUserId });
                    auditCmd.Parameters.Add(new SqlParameter("@Details", SqlDbType.NVarChar, -1)
                    {
                        Value = $"Created platform user {cleanEmail} ({request.FullName}) with custom page access: {string.Join(", ", normalizedPages)}"
                    });
                    await auditCmd.ExecuteNonQueryAsync(ct).ConfigureAwait(false);
                }

                return new PlatformUserDetailResponse(
                    userId,
                    request.FullName.Trim(),
                    cleanEmail,
                    roleCode,
                    true,
                    normalizedPages,
                    DateTimeOffset.UtcNow);
            },
            IsolationLevel.ReadCommitted,
            cancellationToken).ConfigureAwait(false);
    }

    public async Task<PlatformUserDetailResponse> UpdatePlatformUserAsync(
        Guid actorUserId,
        Guid targetUserId,
        UpdatePlatformUserRequest request,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.FullName))
            throw new ArgumentException("Full name is required.");

        var normalizedPages = (request.PageAccess ?? [])
            .Select(p => p.Trim().ToLowerInvariant())
            .Distinct()
            .ToList();

        if (normalizedPages.Count == 0)
        {
            normalizedPages = ["overview"];
        }

        return await baseDAL.ExecutePlatformInTransactionAsync(
            "Platform.Users.Update",
            async (connection, transaction, ct) =>
            {
                // Check if deactivating or removing users access
                if (!request.IsActive || !normalizedPages.Contains("users"))
                {
                    const string countAdminsSql = """
                        SELECT COUNT(DISTINCT a.UserId)
                        FROM platform.Administrators a
                        LEFT JOIN platform.AdministratorPermissions ap ON ap.UserId = a.UserId
                        WHERE a.IsActive = 1
                          AND a.UserId != @TargetUserId
                          AND (a.RoleCode = 'OperationsAdmin' OR ap.PermissionCode = 'users');
                        """;

                    using var countCmd = connection.CreateCommand();
                    countCmd.Transaction = transaction;
                    countCmd.CommandText = countAdminsSql;
                    countCmd.Parameters.Add(new SqlParameter("@TargetUserId", SqlDbType.UniqueIdentifier) { Value = targetUserId });
                    var otherAdmins = Convert.ToInt32(await countCmd.ExecuteScalarAsync(ct).ConfigureAwait(false), CultureInfo.InvariantCulture);
                    if (otherAdmins == 0)
                    {
                        throw new InvalidOperationException("Cannot deactivate or remove user management access from the last active administrative user.");
                    }
                }

                // Update auth.Users full name
                const string updateNameSql = """
                    UPDATE auth.Users
                    SET FullName = @FullName, UpdatedAt = SYSUTCDATETIME()
                    WHERE Id = @UserId;
                    """;

                using (var nameCmd = connection.CreateCommand())
                {
                    nameCmd.Transaction = transaction;
                    nameCmd.CommandText = updateNameSql;
                    nameCmd.Parameters.Add(new SqlParameter("@FullName", SqlDbType.NVarChar, 200) { Value = request.FullName.Trim() });
                    nameCmd.Parameters.Add(new SqlParameter("@UserId", SqlDbType.UniqueIdentifier) { Value = targetUserId });
                    await nameCmd.ExecuteNonQueryAsync(ct).ConfigureAwait(false);
                }

                var roleCode = normalizedPages.Contains("users") ? "OperationsAdmin" : "Support";

                // Update platform.Administrators
                const string updateAdminSql = """
                    UPDATE platform.Administrators
                    SET RoleCode = @RoleCode, IsActive = @IsActive
                    WHERE UserId = @UserId;
                    """;

                using (var adminCmd = connection.CreateCommand())
                {
                    adminCmd.Transaction = transaction;
                    adminCmd.CommandText = updateAdminSql;
                    adminCmd.Parameters.Add(new SqlParameter("@RoleCode", SqlDbType.VarChar, 32) { Value = roleCode });
                    adminCmd.Parameters.Add(new SqlParameter("@IsActive", SqlDbType.Bit) { Value = request.IsActive });
                    adminCmd.Parameters.Add(new SqlParameter("@UserId", SqlDbType.UniqueIdentifier) { Value = targetUserId });
                    await adminCmd.ExecuteNonQueryAsync(ct).ConfigureAwait(false);
                }

                // Replace permissions
                const string deletePermsSql = "DELETE FROM platform.AdministratorPermissions WHERE UserId = @UserId;";
                using (var delCmd = connection.CreateCommand())
                {
                    delCmd.Transaction = transaction;
                    delCmd.CommandText = deletePermsSql;
                    delCmd.Parameters.Add(new SqlParameter("@UserId", SqlDbType.UniqueIdentifier) { Value = targetUserId });
                    await delCmd.ExecuteNonQueryAsync(ct).ConfigureAwait(false);
                }

                foreach (var page in normalizedPages)
                {
                    const string insertPermSql = """
                        INSERT INTO platform.AdministratorPermissions (UserId, PermissionCode)
                        VALUES (@UserId, @PermissionCode);
                        """;

                    using var permCmd = connection.CreateCommand();
                    permCmd.Transaction = transaction;
                    permCmd.CommandText = insertPermSql;
                    permCmd.Parameters.Add(new SqlParameter("@UserId", SqlDbType.UniqueIdentifier) { Value = targetUserId });
                    permCmd.Parameters.Add(new SqlParameter("@PermissionCode", SqlDbType.VarChar, 80) { Value = page });
                    await permCmd.ExecuteNonQueryAsync(ct).ConfigureAwait(false);
                }

                // Audit event
                const string auditSql = """
                    INSERT INTO platform.AdminAuditEvents (ActorUserId, BusinessId, Action, Details, CreatedAt)
                    VALUES (@ActorUserId, NULL, 'PlatformUserUpdated', @Details, SYSUTCDATETIME());
                    """;

                using (var auditCmd = connection.CreateCommand())
                {
                    auditCmd.Transaction = transaction;
                    auditCmd.CommandText = auditSql;
                    auditCmd.Parameters.Add(new SqlParameter("@ActorUserId", SqlDbType.UniqueIdentifier) { Value = actorUserId });
                    auditCmd.Parameters.Add(new SqlParameter("@Details", SqlDbType.NVarChar, -1)
                    {
                        Value = $"Updated platform user {targetUserId}: Active={request.IsActive}, Name={request.FullName.Trim()}, Pages={string.Join(", ", normalizedPages)}"
                    });
                    await auditCmd.ExecuteNonQueryAsync(ct).ConfigureAwait(false);
                }

                // Fetch email & created
                const string getEmailSql = "SELECT Email, CreatedAt FROM auth.Users WHERE Id = @UserId;";
                string email = "";
                DateTimeOffset? createdAt = null;
                using (var emailCmd = connection.CreateCommand())
                {
                    emailCmd.Transaction = transaction;
                    emailCmd.CommandText = getEmailSql;
                    emailCmd.Parameters.Add(new SqlParameter("@UserId", SqlDbType.UniqueIdentifier) { Value = targetUserId });
                    using var r = await emailCmd.ExecuteReaderAsync(ct).ConfigureAwait(false);
                    if (await r.ReadAsync(ct).ConfigureAwait(false))
                    {
                        email = r.GetString(0);
                        createdAt = new DateTimeOffset(DateTime.SpecifyKind(r.GetDateTime(1), DateTimeKind.Utc));
                    }
                }

                return new PlatformUserDetailResponse(
                    targetUserId,
                    request.FullName.Trim(),
                    email,
                    roleCode,
                    request.IsActive,
                    normalizedPages,
                    createdAt);
            },
            IsolationLevel.ReadCommitted,
            cancellationToken).ConfigureAwait(false);
    }

    public async Task DeletePlatformUserAsync(
        Guid actorUserId,
        Guid targetUserId,
        CancellationToken cancellationToken)
    {
        if (actorUserId == targetUserId)
        {
            throw new InvalidOperationException("You cannot delete your own administrative account.");
        }

        await baseDAL.ExecutePlatformInTransactionAsync(
            "Platform.Users.Delete",
            async (connection, transaction, ct) =>
            {
                // Verify another active admin exists
                const string countAdminsSql = """
                    SELECT COUNT(*)
                    FROM platform.Administrators
                    WHERE IsActive = 1 AND UserId != @TargetUserId;
                    """;

                using (var countCmd = connection.CreateCommand())
                {
                    countCmd.Transaction = transaction;
                    countCmd.CommandText = countAdminsSql;
                    countCmd.Parameters.Add(new SqlParameter("@TargetUserId", SqlDbType.UniqueIdentifier) { Value = targetUserId });
                    var otherAdmins = Convert.ToInt32(await countCmd.ExecuteScalarAsync(ct).ConfigureAwait(false), CultureInfo.InvariantCulture);
                    if (otherAdmins == 0)
                    {
                        throw new InvalidOperationException("Cannot delete the last active platform administrator.");
                    }
                }

                // Delete permissions
                const string delPermsSql = "DELETE FROM platform.AdministratorPermissions WHERE UserId = @UserId;";
                using (var delCmd = connection.CreateCommand())
                {
                    delCmd.Transaction = transaction;
                    delCmd.CommandText = delPermsSql;
                    delCmd.Parameters.Add(new SqlParameter("@UserId", SqlDbType.UniqueIdentifier) { Value = targetUserId });
                    await delCmd.ExecuteNonQueryAsync(ct).ConfigureAwait(false);
                }

                // Delete administrator record
                const string delAdminSql = "DELETE FROM platform.Administrators WHERE UserId = @UserId;";
                using (var adminCmd = connection.CreateCommand())
                {
                    adminCmd.Transaction = transaction;
                    adminCmd.CommandText = delAdminSql;
                    adminCmd.Parameters.Add(new SqlParameter("@UserId", SqlDbType.UniqueIdentifier) { Value = targetUserId });
                    await adminCmd.ExecuteNonQueryAsync(ct).ConfigureAwait(false);
                }

                // Audit event
                const string auditSql = """
                    INSERT INTO platform.AdminAuditEvents (ActorUserId, BusinessId, Action, Details, CreatedAt)
                    VALUES (@ActorUserId, NULL, 'PlatformUserDeleted', @Details, SYSUTCDATETIME());
                    """;

                using (var auditCmd = connection.CreateCommand())
                {
                    auditCmd.Transaction = transaction;
                    auditCmd.CommandText = auditSql;
                    auditCmd.Parameters.Add(new SqlParameter("@ActorUserId", SqlDbType.UniqueIdentifier) { Value = actorUserId });
                    auditCmd.Parameters.Add(new SqlParameter("@Details", SqlDbType.NVarChar, -1)
                    {
                        Value = $"Deleted platform user {targetUserId}"
                    });
                    await auditCmd.ExecuteNonQueryAsync(ct).ConfigureAwait(false);
                }

                return true;
            },
            IsolationLevel.ReadCommitted,
            cancellationToken).ConfigureAwait(false);
    }

    // ─── Mapping helper ──────────────────────────────────────────────────────

    private static PlatformBusinessSummaryResponse MapBusiness(SqlDataReader r) =>
        new(r.GetGuid(0), r.GetString(1), r.GetString(2), r.GetString(3), r.GetString(4),
            r.GetString(5), r.GetString(6),
            new DateTimeOffset(DateTime.SpecifyKind(r.GetDateTime(7), DateTimeKind.Utc)),
            r.IsDBNull(8) ? null : r.GetString(8),
            r.IsDBNull(9) ? null : r.GetString(9),
            r.IsDBNull(10) ? null : (decimal?)r.GetDecimal(10),
            (int)r.GetInt64(11),
            r.IsDBNull(12) ? null : r.GetString(12));

    // ─── Parameter helpers ────────────────────────────────────────────────────

    private static SqlParameter Int(string name, int value) =>
        new(name, SqlDbType.Int) { Value = value };

    private static SqlParameter UniqueIdentifier(string name, Guid value) =>
        new(name, SqlDbType.UniqueIdentifier) { Value = value };

    private static SqlParameter NVarChar(string name, string? value, int size) =>
        size == -1
            ? new(name, SqlDbType.NVarChar, -1) { Value = value ?? (object)DBNull.Value }
            : new(name, SqlDbType.NVarChar, size) { Value = value ?? (object)DBNull.Value };

    private static SqlParameter NullableNVarChar(string name, string? value, int size) =>
        new(name, SqlDbType.NVarChar, size) { Value = value is null ? DBNull.Value : (object)value };

    private static SqlParameter Decimal(string name, decimal value) =>
        new(name, SqlDbType.Decimal) { Precision = 19, Scale = 2, Value = value };

    private static SqlParameter Bit(string name, bool value) =>
        new(name, SqlDbType.Bit) { Value = value };

    private static SqlParameter BigInt(string name, long value) =>
        new(name, SqlDbType.BigInt) { Value = value };

    private static SqlParameter NullBigInt(string name) =>
        new(name, SqlDbType.BigInt) { Value = DBNull.Value };

    private static SqlParameter DateTime2(string name, DateTime value) =>
        new(name, SqlDbType.DateTime2, 3) { Value = value };
}
