namespace ServiceDesk.Application.DataControls;

public sealed record ExportRequestResponse(
    Guid Id,
    Guid BusinessId,
    Guid RequestedByMemberId,
    string ExportType,
    string Status,
    string? StorageKey,
    DateTimeOffset CreatedAt,
    DateTimeOffset? ExpiresAt);

public sealed record CreateExportRequest(
    string ExportType);

public sealed record ExportPackageResponse(
    string FileName,
    string ContentType,
    byte[] Content);

public sealed record AuditEventResponse(
    Guid Id,
    Guid? ActorUserId,
    string Action,
    string EntityType,
    Guid? EntityId,
    string? Changes,
    DateTimeOffset CreatedAt);

public interface IDataExportService
{
    Task<ExportRequestResponse> CreateExportAsync(
        Guid businessId,
        Guid requestedByMemberId,
        CreateExportRequest request,
        CancellationToken cancellationToken);

    Task<IReadOnlyList<ExportRequestResponse>> ListExportsAsync(
        Guid businessId,
        CancellationToken cancellationToken);

    Task<ExportPackageResponse?> GetExportPackageAsync(
        Guid businessId,
        Guid exportId,
        CancellationToken cancellationToken);
}

public interface IAuditService
{
    Task RecordAuditEventAsync(
        Guid businessId,
        Guid? actorUserId,
        string action,
        string entityType,
        Guid? entityId,
        string? changes,
        CancellationToken cancellationToken);

    Task<IReadOnlyList<AuditEventResponse>> ListAuditEventsAsync(
        Guid businessId,
        int limit,
        CancellationToken cancellationToken);
}
