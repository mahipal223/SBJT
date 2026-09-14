using ServiceDesk.Domain.Identity;

namespace ServiceDesk.Application.Security;

public sealed record TenantContext(
    Guid BusinessId,
    Guid UserId,
    Guid MemberId,
    BusinessRole Role,
    IReadOnlySet<string> Permissions)
{
    public bool HasPermission(string permission) => Permissions.Contains(permission);
}
