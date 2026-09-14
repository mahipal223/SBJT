namespace ServiceDesk.Application.Platform;

public sealed record PlatformBusinessSummaryResponse(
    Guid Id,
    string Name,
    string Industry,
    string Status,
    string TimeZone,
    string Currency,
    string BillingEmail,
    DateTimeOffset CreatedAt,
    string? PlanCode,
    string? PlanName,
    decimal? PlanPrice,
    int MemberCount,
    string? SubscriptionStatus);

public sealed record UpdateBusinessStatusRequest(
    string Status,
    string Reason);

public sealed record PlatformPlanDistributionItem(
    string PlanName,
    int BusinessCount,
    decimal Percentage);

public sealed record PlatformIndustryDistributionItem(
    string Industry,
    int BusinessCount,
    decimal Percentage);

public sealed record PlatformMetricsResponse(
    int TotalBusinesses,
    int ActiveBusinesses,
    int SuspendedBusinesses,
    int TrialBusinesses,
    decimal MonthlyRecurringRevenue,
    decimal TrialConversionRate,
    decimal ServiceHealthPercentage,
    string SystemStatus,
    IReadOnlyList<PlatformPlanDistributionItem> PlanDistribution,
    IReadOnlyList<PlatformIndustryDistributionItem> IndustryDistribution);

public sealed record PlatformPlanDetailResponse(
    Guid Id,
    string Code,
    int Revision,
    string Name,
    string BillingInterval,
    decimal Price,
    string Currency,
    bool IsPublished,
    IReadOnlyList<PlatformPlanEntitlementRow> Entitlements);

public sealed record PlatformPlanEntitlementRow(
    string FeatureCode,
    bool Enabled,
    long? LimitValue,
    string DisplayText);

public sealed record CreatePlatformPlanRequest(
    string Code,
    string Name,
    string BillingInterval,
    decimal Price,
    string Currency,
    bool IsPublished,
    IReadOnlyList<PlatformPlanEntitlementRow> Entitlements);

public sealed record BackupRunResponse(
    Guid Id,
    string ProviderReference,
    string Status,
    DateTimeOffset StartedAt,
    DateTimeOffset? CompletedAt);

public sealed record RestoreRunResponse(
    Guid Id,
    Guid BackupRunId,
    Guid RequestedByUserId,
    string TargetEnvironment,
    string Status,
    DateTimeOffset StartedAt,
    DateTimeOffset? CompletedAt);

public sealed record CreateRestoreRequest(
    Guid BackupRunId,
    string TargetEnvironment);

public sealed record PlatformAdminAuditEventResponse(
    Guid Id,
    Guid ActorUserId,
    Guid? BusinessId,
    string? BusinessName,
    string Action,
    string? Details,
    DateTimeOffset CreatedAt);

public sealed record SupportGrantResponse(
    Guid Id,
    Guid BusinessId,
    Guid AdminUserId,
    string Scope,
    DateTimeOffset ExpiresAt,
    DateTimeOffset? RevokedAt,
    bool IsActive,
    DateTimeOffset CreatedAt);

public sealed record CreateSupportGrantRequest(
    Guid AdminUserId,
    int DurationHours,
    string Reason);

public interface IPlatformAdminService
{
    Task<IReadOnlyList<PlatformBusinessSummaryResponse>> GetBusinessesAsync(
        string? search,
        string? status,
        int page,
        int pageSize,
        CancellationToken cancellationToken);

    Task<PlatformBusinessSummaryResponse?> GetBusinessAsync(
        Guid businessId,
        CancellationToken cancellationToken);

    Task UpdateBusinessStatusAsync(
        Guid businessId,
        Guid actorUserId,
        UpdateBusinessStatusRequest request,
        CancellationToken cancellationToken);

    Task<PlatformMetricsResponse> GetMetricsAsync(
        CancellationToken cancellationToken);

    Task<IReadOnlyList<PlatformPlanDetailResponse>> GetPlansAsync(
        CancellationToken cancellationToken);

    Task<PlatformPlanDetailResponse> CreatePlanAsync(
        Guid actorUserId,
        CreatePlatformPlanRequest request,
        CancellationToken cancellationToken);

    Task<IReadOnlyList<BackupRunResponse>> GetBackupRunsAsync(
        int limit,
        CancellationToken cancellationToken);

    Task<RestoreRunResponse> CreateRestoreRunAsync(
        Guid actorUserId,
        CreateRestoreRequest request,
        CancellationToken cancellationToken);

    Task<RestoreRunResponse?> GetRestoreRunAsync(
        Guid restoreId,
        CancellationToken cancellationToken);

    Task<IReadOnlyList<PlatformAdminAuditEventResponse>> GetAdminAuditEventsAsync(
        int limit,
        CancellationToken cancellationToken);

    Task<IReadOnlyList<SupportGrantResponse>> GetSupportGrantsAsync(
        Guid businessId,
        CancellationToken cancellationToken);

    Task<SupportGrantResponse> CreateSupportGrantAsync(
        Guid businessId,
        Guid actorUserId,
        Guid approvedByMemberId,
        CreateSupportGrantRequest request,
        CancellationToken cancellationToken);

    Task RevokeSupportGrantAsync(
        Guid businessId,
        Guid grantId,
        Guid actorUserId,
        CancellationToken cancellationToken);
}
