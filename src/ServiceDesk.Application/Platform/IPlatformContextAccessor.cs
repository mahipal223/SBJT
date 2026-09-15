using ServiceDesk.Application.Security;

namespace ServiceDesk.Application.Platform;

public sealed record PlatformContext(
    Guid OperatorUserId,
    string FullName,
    string Email,
    string RoleCode,
    IReadOnlySet<string> Permissions)
{
    public bool HasPermission(string permission) =>
        Permissions.Contains(permission);

    public static IReadOnlySet<string> GetPermissionsForRole(string roleCode)
    {
        var permissions = new HashSet<string>(StringComparer.Ordinal);

        if (string.Equals(roleCode, "OperationsAdmin", StringComparison.OrdinalIgnoreCase))
        {
            // Superadmin has access to all platform areas
            permissions.Add(Security.Permissions.PlatformSupport);
            permissions.Add(Security.Permissions.PlatformBillingAdmin);
            permissions.Add(Security.Permissions.PlatformOperationsAdmin);
        }
        else if (string.Equals(roleCode, "BillingAdmin", StringComparison.OrdinalIgnoreCase))
        {
            permissions.Add(Security.Permissions.PlatformSupport);
            permissions.Add(Security.Permissions.PlatformBillingAdmin);
        }
        else if (string.Equals(roleCode, "Support", StringComparison.OrdinalIgnoreCase))
        {
            permissions.Add(Security.Permissions.PlatformSupport);
        }

        return permissions;
    }

    public static PlatformContext Create(PlatformAdministratorRecord admin)
    {
        var permissions = GetPermissionsForRole(admin.RoleCode);
        return new PlatformContext(
            admin.UserId,
            admin.FullName,
            admin.Email,
            admin.RoleCode,
            permissions);
    }
}

public interface IPlatformContextAccessor
{
    PlatformContext? Current { get; }
}
