namespace ServiceDesk.Application.Work;

public sealed record CustomerRecord(
    Guid Id, Guid BusinessId, string Name, string? CompanyName, string? Email,
    string Phone, string CustomerType, string AddressLine1, string City,
    string StateCode, string PostalCode, bool IsArchived, DateTimeOffset CreatedAt);

public sealed record CreateCustomerCommand(
    string Name, string? CompanyName, string? Email, string Phone,
    string CustomerType, string AddressLine1, string City, string StateCode, string PostalCode);

public sealed record JobRecord(
    Guid Id, Guid BusinessId, Guid CustomerId, string JobNumber, string Title,
    string? Description, string Status, string Priority, DateOnly? ScheduledDate,
    string? ArrivalWindow, Guid? AssignedMemberId, decimal Total, DateTimeOffset CreatedAt);

public sealed record CreateJobCommand(
    Guid CustomerId, string Title, string? Description, string Priority,
    DateOnly? ScheduledDate, string? ArrivalWindow, Guid? AssignedMemberId);

public sealed record ChangeJobStatusCommand(string Status, string? Reason = null);

public sealed record PageResult<T>(IReadOnlyList<T> Items, int Total, int Page, int PageSize);

public sealed record CatalogItemRecord(Guid Id, Guid BusinessId, string ItemType, string Name, string Unit, decimal UnitCost, decimal UnitPrice, string? TaxCategory, bool IsArchived);
public sealed record CreateCatalogItemCommand(string ItemType, string Name, string Unit, decimal UnitCost, decimal UnitPrice, string? TaxCategory);
public sealed record JobItemRecord(Guid Id, Guid BusinessId, Guid JobId, Guid? CatalogItemId, string ItemType, string Description, decimal Quantity, string Unit, decimal UnitPrice, decimal DiscountAmount, decimal TaxAmount, int SortOrder, decimal LineTotal);
public sealed record ReplaceJobItemCommand(Guid? CatalogItemId, string ItemType, string Description, decimal Quantity, string Unit, decimal UnitPrice, decimal DiscountAmount, decimal TaxAmount);
public sealed record JobItemSet(IReadOnlyList<JobItemRecord> Items, decimal Subtotal, decimal DiscountTotal, decimal TaxTotal, decimal Total);

public interface IWorkStore
{
    Task<PageResult<CustomerRecord>> ListCustomersAsync(Guid businessId, string? search, bool includeArchived, int page, int pageSize, CancellationToken cancellationToken = default);
    Task<CustomerRecord?> GetCustomerAsync(Guid businessId, Guid customerId, CancellationToken cancellationToken = default);
    Task<CustomerRecord> CreateCustomerAsync(Guid businessId, CreateCustomerCommand command, CancellationToken cancellationToken = default);
    Task<PageResult<JobRecord>> ListJobsAsync(Guid businessId, string? search, string? status, int page, int pageSize, CancellationToken cancellationToken = default);
    Task<JobRecord?> GetJobAsync(Guid businessId, Guid jobId, CancellationToken cancellationToken = default);
    Task<JobRecord> CreateJobAsync(Guid businessId, CreateJobCommand command, int jobsPerPeriodLimit, CancellationToken cancellationToken = default);
    Task<JobRecord> ChangeJobStatusAsync(Guid businessId, Guid jobId, ChangeJobStatusCommand command, CancellationToken cancellationToken = default);
    Task<PageResult<CatalogItemRecord>> ListCatalogItemsAsync(Guid businessId, string? search, string? itemType, int page, int pageSize, CancellationToken cancellationToken = default);
    Task<CatalogItemRecord> CreateCatalogItemAsync(Guid businessId, CreateCatalogItemCommand command, CancellationToken cancellationToken = default);
    Task<JobItemSet> GetJobItemsAsync(Guid businessId, Guid jobId, CancellationToken cancellationToken = default);
    Task<JobItemSet> ReplaceJobItemsAsync(Guid businessId, Guid jobId, IReadOnlyList<ReplaceJobItemCommand> commands, CancellationToken cancellationToken = default);
}

public sealed class WorkRuleException(string code, string message) : Exception(message)
{
    public string Code { get; } = code;
}
