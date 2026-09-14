using ServiceDesk.Application.Tenancy;

namespace ServiceDesk.Infrastructure.Tenancy;

public sealed class InMemoryBusinessStore : IBusinessService
{
    private static readonly Guid DemoBusinessId = Guid.Parse("11111111-1111-1111-1111-111111111111");

    private readonly List<BusinessProfileResponse> _businesses =
    [
        new(
            DemoBusinessId,
            "Northstar Services",
            "Plumbing",
            "Active",
            "Central Time (US & Canada)",
            "USD",
            "owner@northstar.example",
            "(512) 555-0100",
            "1200 South Lamar Blvd",
            "Austin",
            "TX",
            "78704",
            false,
            DateTimeOffset.UtcNow)
    ];

    public Task<BusinessProfileResponse> CreateAsync(
        Guid userId,
        string subject,
        string email,
        string fullName,
        CreateBusinessCommand command,
        CancellationToken cancellationToken)
    {
        var id = Guid.NewGuid();
        var profile = new BusinessProfileResponse(
            id,
            command.Name.Trim(),
            command.Industry,
            "Active",
            command.TimeZone ?? "UTC",
            "USD",
            email,
            command.Phone,
            command.Address,
            command.City,
            command.State,
            command.Zip,
            command.SoloMode,
            DateTimeOffset.UtcNow);

        _businesses.Add(profile);
        return Task.FromResult(profile);
    }

    public Task<BusinessProfileResponse?> GetAsync(
        Guid businessId,
        CancellationToken cancellationToken)
    {
        var found = _businesses.FirstOrDefault(b => b.Id == businessId);
        return Task.FromResult(found);
    }

    public Task<BusinessProfileResponse?> UpdateAsync(
        Guid businessId,
        UpdateBusinessCommand command,
        CancellationToken cancellationToken)
    {
        var existing = _businesses.FirstOrDefault(b => b.Id == businessId);
        if (existing is null)
        {
            return Task.FromResult<BusinessProfileResponse?>(null);
        }

        var updated = new BusinessProfileResponse(
            businessId,
            command.Name ?? existing.Name,
            command.Industry ?? existing.Industry,
            existing.Status,
            command.TimeZone ?? existing.TimeZone,
            command.Currency ?? existing.Currency,
            existing.BillingEmail,
            command.Phone ?? existing.Phone,
            command.Address ?? existing.Address,
            command.City ?? existing.City,
            command.State ?? existing.State,
            command.Zip ?? existing.Zip,
            existing.SoloMode,
            existing.CreatedAt);

        _businesses.Remove(existing);
        _businesses.Add(updated);
        return Task.FromResult<BusinessProfileResponse?>(updated);
    }

    public Task<WorkspaceSummaryResponse?> GetWorkspaceAsync(
        Guid businessId,
        Guid userId,
        CancellationToken cancellationToken)
    {
        var business = _businesses.FirstOrDefault(b => b.Id == businessId);
        if (business is null)
        {
            return Task.FromResult<WorkspaceSummaryResponse?>(null);
        }

        var summary = new WorkspaceSummaryResponse(
            businessId,
            business.Name,
            Guid.NewGuid(),
            userId,
            "Owner",
            ServiceDesk.Application.Security.Permissions.All.Order().ToArray(),
            business);

        return Task.FromResult<WorkspaceSummaryResponse?>(summary);
    }
}
