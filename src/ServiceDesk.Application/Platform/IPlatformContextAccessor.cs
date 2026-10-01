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
            permissions.Add(Security.Permissions.PlatformUsers);
            permissions.Add(Security.Permissions.PlatformOverview);
            permissions.Add(Security.Permissions.PlatformWorkspaces);
            permissions.Add(Security.Permissions.PlatformPlans);
            permissions.Add(Security.Permissions.PlatformBackups);
            permissions.Add(Security.Permissions.PlatformAudit);
            permissions.Add(Security.Permissions.PlatformSmtp);
            permissions.Add(Security.Permissions.PlatformSecurity);
        }
        else if (string.Equals(roleCode, "BillingAdmin", StringComparison.OrdinalIgnoreCase))
        {
            permissions.Add(Security.Permissions.PlatformSupport);
            permissions.Add(Security.Permissions.PlatformBillingAdmin);
            permissions.Add(Security.Permissions.PlatformOverview);
            permissions.Add(Security.Permissions.PlatformWorkspaces);
            permissions.Add(Security.Permissions.PlatformPlans);
        }
        else if (string.Equals(roleCode, "Support", StringComparison.OrdinalIgnoreCase))
        {
            permissions.Add(Security.Permissions.PlatformSupport);
            permissions.Add(Security.Permissions.PlatformOverview);
            permissions.Add(Security.Permissions.PlatformWorkspaces);
            permissions.Add(Security.Permissions.PlatformSecurity);
        }

        return permissions;
    }

    public static PlatformContext Create(PlatformAdministratorRecord admin)
    {
        var permissions = new HashSet<string>(GetPermissionsForRole(admin.RoleCode), StringComparer.Ordinal);
        if (admin.CustomPermissions is not null)
        {
            foreach (var perm in admin.CustomPermissions)
            {
                permissions.Add(perm);
                if (!perm.StartsWith("platform:", StringComparison.OrdinalIgnoreCase))
                {
                    permissions.Add($"platform:{perm}");
                }
            }
        }

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
