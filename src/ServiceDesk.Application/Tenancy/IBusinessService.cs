using System.ComponentModel.DataAnnotations;

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
    [property: Required, StringLength(200, MinimumLength = 1)]
    string Name,
    [property: Required, StringLength(32, MinimumLength = 1)]
    string Industry,
    [property: RegularExpression(@"^[0-9()+ .-]{7,20}$", ErrorMessage = "Phone must be a valid US phone number.")]
    string? Phone,
    [property: StringLength(250)]
    string? Address,
    [property: StringLength(100)]
    string? City,
    [property: RegularExpression(@"^[A-Za-z]{2}$", ErrorMessage = "State must be a two-letter code.")]
    string? State,
    [property: RegularExpression(@"^\d{5}(-\d{4})?$", ErrorMessage = "ZIP must be five digits or ZIP+4.")]
    string? Zip,
    [property: StringLength(80)]
    string? TimeZone,
    bool SoloMode);

public sealed record UpdateBusinessCommand(
    [property: StringLength(200, MinimumLength = 1)]
    string? Name,
    [property: StringLength(32, MinimumLength = 1)]
    string? Industry,
    [property: RegularExpression(@"^[0-9()+ .-]{7,20}$", ErrorMessage = "Phone must be a valid US phone number.")]
    string? Phone,
    [property: StringLength(250)]
    string? Address,
    [property: StringLength(100)]
    string? City,
    [property: RegularExpression(@"^[A-Za-z]{2}$", ErrorMessage = "State must be a two-letter code.")]
    string? State,
    [property: RegularExpression(@"^\d{5}(-\d{4})?$", ErrorMessage = "ZIP must be five digits or ZIP+4.")]
    string? Zip,
    [property: StringLength(80)]
    string? TimeZone,
    [property: RegularExpression(@"^[A-Z]{3}$", ErrorMessage = "Currency must be a three-letter ISO code.")]
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
