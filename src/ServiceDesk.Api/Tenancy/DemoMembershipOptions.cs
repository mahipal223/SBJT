namespace ServiceDesk.Api.Tenancy;

public sealed record DemoMembershipOptions
{
    public IReadOnlyList<DemoMembership> Memberships { get; init; } = [];
}

public sealed record DemoMembership
{
    public Guid BusinessId { get; init; }
    public string BusinessName { get; init; } = string.Empty;
    public Guid UserId { get; init; }
    public Guid MemberId { get; init; }
    public string Role { get; init; } = string.Empty;
    public bool IsActive { get; init; }
    public IReadOnlyList<string> Permissions { get; init; } = [];
}
