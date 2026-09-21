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

public sealed record CreateBusinessCommand
{
    public CreateBusinessCommand(
        string name,
        string industry,
        string? phone,
        string? address,
        string? city,
        string? state,
        string? zip,
        string? timeZone,
        bool soloMode)
    {
        Name = name;
        Industry = industry;
        Phone = phone;
        Address = address;
        City = city;
        State = state;
        Zip = zip;
        TimeZone = timeZone;
        SoloMode = soloMode;
    }

    [Required, StringLength(200, MinimumLength = 1)]
    public string Name { get; init; }

    [Required, StringLength(32, MinimumLength = 1)]
    public string Industry { get; init; }

    [RegularExpression(@"^[0-9()+ .-]{7,20}$", ErrorMessage = "Phone must be a valid US phone number.")]
    public string? Phone { get; init; }

    [StringLength(250)]
    public string? Address { get; init; }

    [StringLength(100)]
    public string? City { get; init; }

    [RegularExpression(@"^[A-Za-z]{2}$", ErrorMessage = "State must be a two-letter code.")]
    public string? State { get; init; }

    [RegularExpression(@"^\d{5}(-\d{4})?$", ErrorMessage = "ZIP must be five digits or ZIP+4.")]
    public string? Zip { get; init; }

    [StringLength(80)]
    public string? TimeZone { get; init; }

    public bool SoloMode { get; init; }
}

public sealed record UpdateBusinessCommand
{
    public UpdateBusinessCommand(
        string? name,
        string? industry,
        string? phone,
        string? address,
        string? city,
        string? state,
        string? zip,
        string? timeZone,
        string? currency)
    {
        Name = name;
        Industry = industry;
        Phone = phone;
        Address = address;
        City = city;
        State = state;
        Zip = zip;
        TimeZone = timeZone;
        Currency = currency;
    }

    [StringLength(200, MinimumLength = 1)]
    public string? Name { get; init; }

    [StringLength(32, MinimumLength = 1)]
    public string? Industry { get; init; }

    [RegularExpression(@"^[0-9()+ .-]{7,20}$", ErrorMessage = "Phone must be a valid US phone number.")]
    public string? Phone { get; init; }

    [StringLength(250)]
    public string? Address { get; init; }

    [StringLength(100)]
    public string? City { get; init; }

    [RegularExpression(@"^[A-Za-z]{2}$", ErrorMessage = "State must be a two-letter code.")]
    public string? State { get; init; }

    [RegularExpression(@"^\d{5}(-\d{4})?$", ErrorMessage = "ZIP must be five digits or ZIP+4.")]
    public string? Zip { get; init; }

    [StringLength(80)]
    public string? TimeZone { get; init; }

    [RegularExpression(@"^[A-Z]{3}$", ErrorMessage = "Currency must be a three-letter ISO code.")]
    public string? Currency { get; init; }
}

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
