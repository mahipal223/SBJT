using ServiceDesk.Application.Abstractions;
using ServiceDesk.Application.Tenancy;
using ServiceDesk.Domain.Identity;

namespace ServiceDesk.Api.Tenancy;

public sealed class ConfigurationMembershipResolver(IConfiguration configuration) : IMembershipResolver
{
    public ValueTask<MembershipAccess?> ResolveAsync(
        Guid userId,
        Guid businessId,
        CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        var result = GetMemberships().FirstOrDefault(member =>
            member.UserId == userId && member.BusinessId == businessId);
        return ValueTask.FromResult(result);
    }

    public ValueTask<IReadOnlyList<MembershipAccess>> ListForUserAsync(
        Guid userId,
        CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        IReadOnlyList<MembershipAccess> result = GetMemberships()
            .Where(member => member.UserId == userId && member.IsActive)
            .ToArray();
        return ValueTask.FromResult(result);
    }

    private MembershipAccess[] GetMemberships()
    {
        var options = configuration.GetSection("DemoTenancy").Get<DemoMembershipOptions>()
            ?? new DemoMembershipOptions();

        return options.Memberships.Select(member => new MembershipAccess(
            member.BusinessId,
            member.BusinessName,
            member.UserId,
            member.MemberId,
            Enum.Parse<BusinessRole>(member.Role, ignoreCase: true),
            member.IsActive,
            member.Permissions.ToHashSet(StringComparer.Ordinal))).ToArray();
    }
}
