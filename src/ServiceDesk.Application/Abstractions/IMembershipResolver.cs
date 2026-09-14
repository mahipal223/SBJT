using ServiceDesk.Application.Tenancy;

namespace ServiceDesk.Application.Abstractions;

public interface IMembershipResolver
{
    ValueTask<MembershipAccess?> ResolveAsync(
        Guid userId,
        Guid businessId,
        CancellationToken cancellationToken);

    ValueTask<IReadOnlyList<MembershipAccess>> ListForUserAsync(
        Guid userId,
        CancellationToken cancellationToken);
}
