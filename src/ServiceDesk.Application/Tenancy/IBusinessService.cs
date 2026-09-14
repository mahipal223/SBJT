namespace ServiceDesk.Application.Tenancy;

public sealed record BusinessProfileResponse(
    Guid Id,
    string Name,
    string Industry,
    string Status,
    string TimeZone,
    string Currency,
    string BillingEmail,
    string? Phone,
    string? Address,
    string? City,
    string? State,
    string? Zip,
    bool SoloMode,
    DateTimeOffset CreatedAt);

public sealed record CreateBusinessCommand(
    string Name,
    string Industry,
    string? Phone,
    string? Address,
    string? City,
    string? State,
    string? Zip,
    string? TimeZone,
    bool SoloMode);

public sealed record UpdateBusinessCommand(
    string? Name,
    string? Industry,
    string? Phone,
    string? Address,
    string? City,
    string? State,
    string? Zip,
    string? TimeZone,
    string? Currency);

public sealed record WorkspaceSummaryResponse(
    Guid BusinessId,
    string BusinessName,
    Guid MemberId,
    Guid UserId,
    string Role,
    IReadOnlyCollection<string> Permissions,
    BusinessProfileResponse Business);

public interface IBusinessService
{
    Task<BusinessProfileResponse> CreateAsync(
        Guid userId,
        string subject,
        string email,
        string fullName,
        CreateBusinessCommand command,
        CancellationToken cancellationToken);

    Task<BusinessProfileResponse?> GetAsync(
        Guid businessId,
        CancellationToken cancellationToken);

    Task<BusinessProfileResponse?> UpdateAsync(
        Guid businessId,
        UpdateBusinessCommand command,
        CancellationToken cancellationToken);

    Task<WorkspaceSummaryResponse?> GetWorkspaceAsync(
        Guid businessId,
        Guid userId,
        CancellationToken cancellationToken);
}
