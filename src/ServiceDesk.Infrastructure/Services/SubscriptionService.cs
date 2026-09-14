using System.Data;
using System.Globalization;
using System.Text.Json;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Logging;
using ServiceDesk.Application.Subscriptions;
using ServiceDesk.Infrastructure.Data;

namespace ServiceDesk.Infrastructure.Services;

public sealed class SubscriptionService(BaseDAL baseDAL, ILogger<SubscriptionService> logger) : ISubscriptionService
{
    private static readonly Action<ILogger, Guid, string, Exception?> LogPlanChangeAttempt =
        LoggerMessage.Define<Guid, string>(
            LogLevel.Information,
            new EventId(3001, nameof(LogPlanChangeAttempt)),
            "Business {BusinessId} attempting to change subscription plan to {TargetPlanId}");

    private static readonly Action<ILogger, Guid, string, Exception?> LogPlanChangeSucceeded =
        LoggerMessage.Define<Guid, string>(
            LogLevel.Information,
            new EventId(3002, nameof(LogPlanChangeSucceeded)),
            "Business {BusinessId} successfully changed plan to {TargetPlanCode}");

    private static readonly Action<ILogger, Guid, string, Exception?> LogPlanChangeBlocked =
        LoggerMessage.Define<Guid, string>(
            LogLevel.Warning,
            new EventId(3003, nameof(LogPlanChangeBlocked)),
            "Business {BusinessId} plan change blocked: {Reason}");

    private static readonly Action<ILogger, Guid, string, Exception?> LogBillingEventSimulated =
        LoggerMessage.Define<Guid, string>(
            LogLevel.Information,
            new EventId(3004, nameof(LogBillingEventSimulated)),
            "Business {BusinessId} simulated billing event {EventType}");

    public async Task<SubscriptionOverviewRecord> GetOverviewAsync(
        Guid businessId,
        CancellationToken cancellationToken = default)
    {
        var subscription = await GetCurrentSubscriptionAsync(businessId, cancellationToken).ConfigureAwait(false);
        var plans = await GetPublishedPlansAsync(cancellationToken).ConfigureAwait(false);

        // Calculate live usage
        var usage = await GetLiveUsageAsync(businessId, subscription, cancellationToken).ConfigureAwait(false);

        return new SubscriptionOverviewRecord(subscription, plans, usage);
    }

    public async Task<IReadOnlyList<PlanRecord>> GetPublishedPlansAsync(
        CancellationToken cancellationToken = default)
    {
        const string sql = """
            SELECT p.Id, p.Code, p.Name, p.BillingInterval, p.Price, p.Currency, p.IsPublished,
                   e.FeatureCode, e.Enabled, e.LimitValue, e.DisplayText
            FROM platform.Plans p
            LEFT JOIN platform.PlanEntitlements e ON p.Id = e.PlanId
            WHERE p.IsPublished = 1
            ORDER BY p.Price ASC, e.FeatureCode ASC;
            """;

        await using var connection = await baseDAL.OpenConnectionAsync(Guid.Empty, cancellationToken).ConfigureAwait(false);
        await using var cmd = connection.CreateCommand();
        cmd.CommandText = sql;
        await using var reader = await cmd.ExecuteReaderAsync(cancellationToken).ConfigureAwait(false);

        var planDict = new Dictionary<Guid, (PlanHeader Header, List<PlanEntitlementRecord> Entitlements)>();

        while (await reader.ReadAsync(cancellationToken).ConfigureAwait(false))
        {
            var planId = reader.GetGuid(0);
            if (!planDict.TryGetValue(planId, out var entry))
            {
                var header = new PlanHeader(
                    planId,
                    reader.GetString(1),
                    reader.GetString(2),
                    reader.GetString(3),
                    reader.GetDecimal(4),
                    reader.GetString(5),
                    reader.GetBoolean(6));
                entry = (header, []);
                planDict[planId] = entry;
            }

            if (!reader.IsDBNull(7))
            {
                entry.Entitlements.Add(new PlanEntitlementRecord(
                    reader.GetString(7),
                    reader.GetBoolean(8),
                    reader.IsDBNull(9) ? null : reader.GetInt64(9),
                    reader.GetString(10)));
            }
        }

        return planDict.Values
            .Select(x => new PlanRecord(
                x.Header.Id,
                x.Header.Code,
                x.Header.Name,
                x.Header.BillingInterval,
                x.Header.Price,
                x.Header.Currency,
                x.Header.IsPublished,
                x.Entitlements))
            .ToList();
    }

    public async Task<ChangePlanResult> ChangePlanAsync(
        Guid businessId,
        Guid actorUserId,
        ChangePlanCommand command,
        CancellationToken cancellationToken = default)
    {
        LogPlanChangeAttempt(logger, businessId, command.TargetPlanId.ToString(), null);

        var current = await GetCurrentSubscriptionAsync(businessId, cancellationToken).ConfigureAwait(false);
        if (current.PlanId == command.TargetPlanId)
        {
            return new ChangePlanResult(true, "The workspace is already on this plan.", current, []);
        }

        var plans = await GetPublishedPlansAsync(cancellationToken).ConfigureAwait(false);
        var targetPlan = plans.FirstOrDefault(p => p.Id == command.TargetPlanId);
        if (targetPlan is null)
        {
            throw new SubscriptionRuleException("plan_not_found", "The specified plan does not exist or is not available for purchase.");
        }

        // Downgrade blocker check
        var blockers = new List<string>();
        var currentUsage = await GetLiveUsageAsync(businessId, current, cancellationToken).ConfigureAwait(false);

        // Check staff seats
        var seatsUsage = currentUsage.FirstOrDefault(u => u.FeatureCode == "staff.seats");
        var targetSeatsEntitlement = targetPlan.Entitlements.FirstOrDefault(e => e.FeatureCode == "staff.seats");
        if (seatsUsage is not null && targetSeatsEntitlement?.LimitValue is not null)
        {
            if (seatsUsage.CurrentUsage > targetSeatsEntitlement.LimitValue.Value)
            {
                blockers.Add(string.Format(
                    CultureInfo.InvariantCulture,
                    "Cannot downgrade to {0}: Current workspace has {1} staff seat(s) allocated (active members + pending invitations), but {0} only allows {2}. Please deactivate or remove members in Team settings before changing plans.",
                    targetPlan.Name,
                    seatsUsage.CurrentUsage,
                    targetSeatsEntitlement.LimitValue.Value));
            }
        }

        // Check jobs quota if target plan is lower than current usage in active period
        var jobsUsage = currentUsage.FirstOrDefault(u => u.FeatureCode == "jobs.per_period");
        var targetJobsEntitlement = targetPlan.Entitlements.FirstOrDefault(e => e.FeatureCode == "jobs.per_period");
        if (jobsUsage is not null && targetJobsEntitlement?.LimitValue is not null)
        {
            if (jobsUsage.CurrentUsage > targetJobsEntitlement.LimitValue.Value)
            {
                blockers.Add(string.Format(
                    CultureInfo.InvariantCulture,
                    "Cannot downgrade to {0}: You have created {1} jobs in the current billing period, which exceeds the {0} allowance of {2} jobs.",
                    targetPlan.Name,
                    jobsUsage.CurrentUsage,
                    targetJobsEntitlement.LimitValue.Value));
            }
        }

        if (blockers.Count > 0)
        {
            LogPlanChangeBlocked(logger, businessId, string.Join("; ", blockers), null);
            return new ChangePlanResult(false, "Plan change blocked by current usage limits.", current, blockers);
        }

        // Apply plan change inside a transaction
        await baseDAL.ExecuteInTransactionAsync<bool>(
            businessId,
            "Subscriptions.ChangePlan",
            async (conn, tx, ct) =>
            {
                const string updateSubSql = """
                    UPDATE app.Subscriptions
                    SET PlanId = @TargetPlanId,
                        UpdatedAt = SYSUTCDATETIME()
                    WHERE BusinessId = @BusinessId AND IsCurrent = 1;
                    """;

                await using (var cmd = conn.CreateCommand())
                {
                    cmd.Transaction = tx;
                    cmd.CommandText = updateSubSql;
                    cmd.Parameters.Add(new SqlParameter("@BusinessId", SqlDbType.UniqueIdentifier) { Value = businessId });
                    cmd.Parameters.Add(new SqlParameter("@TargetPlanId", SqlDbType.UniqueIdentifier) { Value = targetPlan.Id });
                    await cmd.ExecuteNonQueryAsync(ct).ConfigureAwait(false);
                }

                const string insertChangeSql = """
                    INSERT INTO app.PlanChanges
                        (BusinessId, SubscriptionId, TargetPlanId, Status, EffectiveAt)
                    VALUES
                        (@BusinessId, @SubscriptionId, @TargetPlanId, 'Applied', SYSUTCDATETIME());
                    """;

                await using (var cmd = conn.CreateCommand())
                {
                    cmd.Transaction = tx;
                    cmd.CommandText = insertChangeSql;
                    cmd.Parameters.Add(new SqlParameter("@BusinessId", SqlDbType.UniqueIdentifier) { Value = businessId });
                    cmd.Parameters.Add(new SqlParameter("@SubscriptionId", SqlDbType.UniqueIdentifier) { Value = current.Id });
                    cmd.Parameters.Add(new SqlParameter("@TargetPlanId", SqlDbType.UniqueIdentifier) { Value = targetPlan.Id });
                    await cmd.ExecuteNonQueryAsync(ct).ConfigureAwait(false);
                }

                const string auditSql = """
                    INSERT INTO app.AuditEvents
                        (BusinessId, ActorUserId, Action, EntityType, EntityId, CorrelationId, Changes)
                    VALUES
                        (@BusinessId, @ActorUserId, N'subscription.plan_changed', N'Subscription', @SubscriptionId,
                         CONVERT(nvarchar(100), NEWID()), @Changes);
                    """;

                var auditPayload = JsonSerializer.Serialize(new
                {
                    FromPlanId = current.PlanId,
                    FromPlanCode = current.PlanCode,
                    ToPlanId = targetPlan.Id,
                    ToPlanCode = targetPlan.Code
                });

                await using (var cmd = conn.CreateCommand())
                {
                    cmd.Transaction = tx;
                    cmd.CommandText = auditSql;
                    cmd.Parameters.Add(new SqlParameter("@BusinessId", SqlDbType.UniqueIdentifier) { Value = businessId });
                    cmd.Parameters.Add(new SqlParameter("@ActorUserId", SqlDbType.UniqueIdentifier) { Value = actorUserId == Guid.Empty ? DBNull.Value : actorUserId });
                    cmd.Parameters.Add(new SqlParameter("@SubscriptionId", SqlDbType.UniqueIdentifier) { Value = current.Id });
                    cmd.Parameters.Add(new SqlParameter("@Changes", SqlDbType.NVarChar, -1) { Value = auditPayload });
                    await cmd.ExecuteNonQueryAsync(ct).ConfigureAwait(false);
                }

                return true;
            },
            IsolationLevel.ReadCommitted,
            cancellationToken).ConfigureAwait(false);

        LogPlanChangeSucceeded(logger, businessId, targetPlan.Code, null);
        var updated = await GetCurrentSubscriptionAsync(businessId, cancellationToken).ConfigureAwait(false);
        return new ChangePlanResult(true, string.Format(CultureInfo.InvariantCulture, "Successfully switched to the {0} plan.", targetPlan.Name), updated, []);
    }

    public async Task<SubscriptionRecord> SimulateBillingEventAsync(
        Guid businessId,
        Guid actorUserId,
        SimulateBillingEventCommand command,
        CancellationToken cancellationToken = default)
    {
        LogBillingEventSimulated(logger, businessId, command.EventType, null);

        var current = await GetCurrentSubscriptionAsync(businessId, cancellationToken).ConfigureAwait(false);

        string newStatus = current.Status;
        DateTimeOffset? newGrace = current.GraceEndsAt;
        bool newCancelAtEnd = current.CancelAtPeriodEnd;

        switch (command.EventType.ToLowerInvariant())
        {
            case "payment_failed":
                newStatus = "PastDue";
                newGrace = DateTimeOffset.UtcNow.AddDays(7);
                break;
            case "payment_succeeded":
            case "reactivate":
                newStatus = "Active";
                newGrace = null;
                newCancelAtEnd = false;
                break;
            case "expire":
            case "grace_expired":
                newStatus = "ReadOnly";
                break;
            case "cancel":
                newCancelAtEnd = true;
                break;
            default:
                throw new SubscriptionRuleException("invalid_event", "Unknown billing event type. Supported: payment_failed, payment_succeeded, expire, cancel, reactivate.");
        }

        const string updateSql = """
            UPDATE app.Subscriptions
            SET Status = @Status,
                GraceEndsAt = @GraceEndsAt,
                CancelAtPeriodEnd = @CancelAtPeriodEnd,
                UpdatedAt = SYSUTCDATETIME()
            WHERE BusinessId = @BusinessId AND IsCurrent = 1;
            """;

        await baseDAL.ExecuteNonQueryAsync(
            businessId,
            "Subscriptions.SimulateEvent",
            updateSql,
            [
                new SqlParameter("@BusinessId", SqlDbType.UniqueIdentifier) { Value = businessId },
                new SqlParameter("@Status", SqlDbType.VarChar, 32) { Value = newStatus },
                new SqlParameter("@GraceEndsAt", SqlDbType.DateTime2) { Value = (object?)newGrace?.UtcDateTime ?? DBNull.Value },
                new SqlParameter("@CancelAtPeriodEnd", SqlDbType.Bit) { Value = newCancelAtEnd }
            ],
            cancellationToken).ConfigureAwait(false);

        return await GetCurrentSubscriptionAsync(businessId, cancellationToken).ConfigureAwait(false);
    }

    private async Task<SubscriptionRecord> GetCurrentSubscriptionAsync(
        Guid businessId,
        CancellationToken cancellationToken)
    {
        const string selectSql = """
            SELECT s.Id, s.BusinessId, s.PlanId, p.Code, p.Name, p.Price, p.BillingInterval,
                   s.Status, s.TrialEndsAt, s.PeriodStartsAt, s.PeriodEndsAt, s.GraceEndsAt,
                   s.CancelAtPeriodEnd, s.IsCurrent
            FROM app.Subscriptions s
            JOIN platform.Plans p ON s.PlanId = p.Id
            WHERE s.BusinessId = @BusinessId AND s.IsCurrent = 1;
            """;

        var sub = await baseDAL.ExecuteSingleAsync(
            businessId,
            "Subscriptions.GetCurrent",
            selectSql,
            reader => new SubscriptionRecord(
                reader.GetGuid(0),
                reader.GetGuid(1),
                reader.GetGuid(2),
                reader.GetString(3),
                reader.GetString(4),
                reader.GetDecimal(5),
                reader.GetString(6),
                reader.GetString(7),
                reader.IsDBNull(8) ? null : AsUtcOffset(reader.GetDateTime(8)),
                AsUtcOffset(reader.GetDateTime(9)),
                AsUtcOffset(reader.GetDateTime(10)),
                reader.IsDBNull(11) ? null : AsUtcOffset(reader.GetDateTime(11)),
                reader.GetBoolean(12),
                reader.GetBoolean(13),
                reader.GetString(7) == "ReadOnly" || reader.GetString(7) == "Ended"),
            [new SqlParameter("@BusinessId", SqlDbType.UniqueIdentifier) { Value = businessId }],
            cancellationToken).ConfigureAwait(false);

        if (sub is not null) return sub;

        // Auto-provision default Team subscription if workspace does not have one
        var publishedPlans = await GetPublishedPlansAsync(cancellationToken).ConfigureAwait(false);
        var defaultPlan = publishedPlans.FirstOrDefault(p => p.Code == "TEAM") ?? publishedPlans[0];

        var subId = Guid.NewGuid();
        var now = DateTimeOffset.UtcNow;
        var start = new DateTimeOffset(now.Year, now.Month, 1, 0, 0, 0, TimeSpan.Zero);
        var end = start.AddMonths(1);

        const string insertDefault = """
            INSERT INTO app.Subscriptions
                (BusinessId, Id, PlanId, Status, PeriodStartsAt, PeriodEndsAt, CancelAtPeriodEnd, IsCurrent)
            VALUES
                (@BusinessId, @Id, @PlanId, 'Active', @StartsAt, @EndsAt, 0, 1);
            """;

        await baseDAL.ExecuteNonQueryAsync(
            businessId,
            "Subscriptions.CreateDefault",
            insertDefault,
            [
                new SqlParameter("@BusinessId", SqlDbType.UniqueIdentifier) { Value = businessId },
                new SqlParameter("@Id", SqlDbType.UniqueIdentifier) { Value = subId },
                new SqlParameter("@PlanId", SqlDbType.UniqueIdentifier) { Value = defaultPlan.Id },
                new SqlParameter("@StartsAt", SqlDbType.DateTime2) { Value = start.UtcDateTime },
                new SqlParameter("@EndsAt", SqlDbType.DateTime2) { Value = end.UtcDateTime }
            ],
            cancellationToken).ConfigureAwait(false);

        return new SubscriptionRecord(
            subId, businessId, defaultPlan.Id, defaultPlan.Code, defaultPlan.Name,
            defaultPlan.Price, defaultPlan.BillingInterval, "Active", null, start, end, null, false, true, false);
    }

    private async Task<IReadOnlyList<UsageQuotaRecord>> GetLiveUsageAsync(
        Guid businessId,
        SubscriptionRecord subscription,
        CancellationToken cancellationToken)
    {
        // 1. Staff seats
        const string seatsSql = """
            SELECT
                (SELECT COUNT(1) FROM app.Members WHERE BusinessId = @BusinessId AND Status = 'Active') +
                (SELECT COUNT(1) FROM app.Invitations WHERE BusinessId = @BusinessId AND Status = 'Pending' AND ExpiresAt > SYSUTCDATETIME());
            """;

        var seatsCount = await baseDAL.ExecuteScalarAsync<long>(
            businessId,
            "Usage.Seats",
            seatsSql,
            [new SqlParameter("@BusinessId", SqlDbType.UniqueIdentifier) { Value = businessId }],
            cancellationToken).ConfigureAwait(false);

        // 2. Jobs per period
        const string jobsSql = """
            SELECT COUNT(1)
            FROM app.Jobs
            WHERE BusinessId = @BusinessId
              AND CreatedAt >= @PeriodStart
              AND CreatedAt < @PeriodEnd;
            """;

        var jobsCount = await baseDAL.ExecuteScalarAsync<long>(
            businessId,
            "Usage.Jobs",
            jobsSql,
            [
                new SqlParameter("@BusinessId", SqlDbType.UniqueIdentifier) { Value = businessId },
                new SqlParameter("@PeriodStart", SqlDbType.DateTime2) { Value = subscription.PeriodStartsAt.UtcDateTime },
                new SqlParameter("@PeriodEnd", SqlDbType.DateTime2) { Value = subscription.PeriodEndsAt.UtcDateTime }
            ],
            cancellationToken).ConfigureAwait(false);

        // 3. Storage bytes
        const string storageSql = """
            SELECT ISNULL(SUM(SizeBytes), 0)
            FROM app.JobFiles
            WHERE BusinessId = @BusinessId;
            """;

        var storageBytes = await baseDAL.ExecuteScalarAsync<long>(
            businessId,
            "Usage.Storage",
            storageSql,
            [new SqlParameter("@BusinessId", SqlDbType.UniqueIdentifier) { Value = businessId }],
            cancellationToken).ConfigureAwait(false);

        // Get Plan Entitlements for current plan
        const string entitlementsSql = """
            SELECT FeatureCode, Enabled, LimitValue, DisplayText
            FROM platform.PlanEntitlements
            WHERE PlanId = @PlanId;
            """;

        var entitlements = await baseDAL.ExecuteQueryAsync(
            businessId,
            "Usage.Entitlements",
            entitlementsSql,
            reader => new PlanEntitlementRecord(
                reader.GetString(0),
                reader.GetBoolean(1),
                reader.IsDBNull(2) ? null : reader.GetInt64(2),
                reader.GetString(3)),
            [new SqlParameter("@PlanId", SqlDbType.UniqueIdentifier) { Value = subscription.PlanId }],
            cancellationToken).ConfigureAwait(false);

        var seatsLimit = entitlements.FirstOrDefault(e => e.FeatureCode == "staff.seats")?.LimitValue;
        var jobsLimit = entitlements.FirstOrDefault(e => e.FeatureCode == "jobs.per_period")?.LimitValue;
        var storageLimit = entitlements.FirstOrDefault(e => e.FeatureCode == "storage.bytes")?.LimitValue;

        var seatsPercent = seatsLimit.HasValue && seatsLimit.Value > 0
            ? (int)Math.Min(100, Math.Round((double)seatsCount / seatsLimit.Value * 100))
            : 0;

        var jobsPercent = jobsLimit.HasValue && jobsLimit.Value > 0
            ? (int)Math.Min(100, Math.Round((double)jobsCount / jobsLimit.Value * 100))
            : 0;

        var storagePercent = storageLimit.HasValue && storageLimit.Value > 0
            ? (int)Math.Min(100, Math.Round((double)storageBytes / storageLimit.Value * 100))
            : 0;

        var storageInMb = (double)storageBytes / (1024 * 1024);
        var storageLimitInGb = storageLimit.HasValue ? (double)storageLimit.Value / (1024 * 1024 * 1024) : 0;

        return
        [
            new UsageQuotaRecord(
                "staff.seats",
                "Staff seats",
                seatsCount,
                seatsLimit,
                "seats",
                seatsPercent,
                seatsLimit.HasValue && seatsCount > seatsLimit.Value,
                string.Format(CultureInfo.InvariantCulture, "{0} of {1} seats used", seatsCount, seatsLimit?.ToString(CultureInfo.InvariantCulture) ?? "unlimited")),

            new UsageQuotaRecord(
                "jobs.per_period",
                "Jobs this period",
                jobsCount,
                jobsLimit,
                "jobs",
                jobsPercent,
                jobsLimit.HasValue && jobsCount > jobsLimit.Value,
                string.Format(CultureInfo.InvariantCulture, "{0} of {1} jobs created", jobsCount, jobsLimit?.ToString(CultureInfo.InvariantCulture) ?? "unlimited")),

            new UsageQuotaRecord(
                "storage.bytes",
                "File storage",
                storageBytes,
                storageLimit,
                "bytes",
                storagePercent,
                storageLimit.HasValue && storageBytes > storageLimit.Value,
                string.Format(CultureInfo.InvariantCulture, "{0:0.##} MB of {1:0.##} GB used", storageInMb, storageLimitInGb))
        ];
    }

    private static DateTimeOffset AsUtcOffset(DateTime dateTime) =>
        DateTime.SpecifyKind(dateTime, DateTimeKind.Utc);

    private sealed record PlanHeader(
        Guid Id,
        string Code,
        string Name,
        string BillingInterval,
        decimal Price,
        string Currency,
        bool IsPublished);
}
