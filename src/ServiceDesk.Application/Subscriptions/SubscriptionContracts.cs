namespace ServiceDesk.Application.Subscriptions;

public sealed record PlanEntitlementRecord(
    string FeatureCode,
    bool Enabled,
    long? LimitValue,
    string DisplayText);

public sealed record PlanRecord(
    Guid Id,
    string Code,
    string Name,
    string BillingInterval,
    decimal Price,
    string Currency,
    bool IsPublished,
    IReadOnlyList<PlanEntitlementRecord> Entitlements);

public sealed record SubscriptionRecord(
    Guid Id,
    Guid BusinessId,
    Guid PlanId,
    string PlanCode,
    string PlanName,
    decimal Price,
    string BillingInterval,
    string Status,
    DateTimeOffset? TrialEndsAt,
    DateTimeOffset PeriodStartsAt,
    DateTimeOffset PeriodEndsAt,
    DateTimeOffset? GraceEndsAt,
    bool CancelAtPeriodEnd,
    bool IsCurrent,
    bool IsReadOnly);

public sealed record UsageQuotaRecord(
    string FeatureCode,
    string Name,
    long CurrentUsage,
    long? LimitValue,
    string Unit,
    int PercentageUsed,
    bool IsExceeded,
    string Description);

public sealed record SubscriptionOverviewRecord(
    SubscriptionRecord Subscription,
    IReadOnlyList<PlanRecord> AvailablePlans,
    IReadOnlyList<UsageQuotaRecord> Usage);

public sealed record ChangePlanCommand(
    Guid TargetPlanId);

public sealed record ChangePlanResult(
    bool Success,
    string Message,
    SubscriptionRecord? Subscription,
    IReadOnlyList<string> Blockers);

public sealed record SimulateBillingEventCommand(
    string EventType);

public interface ISubscriptionService
{
    Task<SubscriptionOverviewRecord> GetOverviewAsync(
        Guid businessId,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<PlanRecord>> GetPublishedPlansAsync(
        CancellationToken cancellationToken = default);

    Task<ChangePlanResult> ChangePlanAsync(
        Guid businessId,
        Guid actorUserId,
        ChangePlanCommand command,
        CancellationToken cancellationToken = default);

    Task<SubscriptionRecord> SimulateBillingEventAsync(
        Guid businessId,
        Guid actorUserId,
        SimulateBillingEventCommand command,
        CancellationToken cancellationToken = default);
}

public class SubscriptionRuleException(string code, string message) : Exception(message)
{
    public string Code { get; } = code;
}
