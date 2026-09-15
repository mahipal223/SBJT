using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using ServiceDesk.Application.Abstractions;
using ServiceDesk.Application.Platform;

namespace ServiceDesk.Api.Security;

public sealed class PermissionAuthorizationHandler(
    ITenantContextAccessor tenantContextAccessor,
    IMembershipResolver membershipResolver,
    IPlatformContextAccessor platformContextAccessor,
    IAdministratorResolver administratorResolver)
    : AuthorizationHandler<PermissionRequirement>
{
    protected override async Task HandleRequirementAsync(
        AuthorizationHandlerContext context,
        PermissionRequirement requirement)
    {
        // ── Platform permissions (platform:*) ────────────────────────────────
        if (requirement.Permission.StartsWith("platform:", StringComparison.Ordinal))
        {
            if (platformContextAccessor.Current?.HasPermission(requirement.Permission) == true)
            {
                context.Succeed(requirement);
                return;
            }

            var subject = context.User.FindFirstValue(ClaimTypes.NameIdentifier)
                          ?? context.User.FindFirstValue("sub");

            if (!string.IsNullOrWhiteSpace(subject) && Guid.TryParse(subject, out var adminUserId))
            {
                var admin = await administratorResolver.ResolveAsync(adminUserId, CancellationToken.None);
                if (admin is not null && admin.IsActive)
                {
                    var permissions = PlatformContext.GetPermissionsForRole(admin.RoleCode);
                    if (permissions.Contains(requirement.Permission))
                    {
                        context.Succeed(requirement);
                    }
                }
            }

            // Platform permissions must NEVER fall through to tenant context or tenant memberships
            return;
        }

        // ── Tenant permissions ───────────────────────────────────────────────
        if (tenantContextAccessor.Current?.HasPermission(requirement.Permission) == true)
        {
            context.Succeed(requirement);
            return;
        }

        if (context.User.HasClaim("permission", requirement.Permission) ||
            context.User.HasClaim("scope", requirement.Permission))
        {
            context.Succeed(requirement);
            return;
        }

        var tenantSubject = context.User.FindFirstValue(ClaimTypes.NameIdentifier)
                            ?? context.User.FindFirstValue("sub");

        if (!string.IsNullOrWhiteSpace(tenantSubject) && Guid.TryParse(tenantSubject, out var userId))
        {
            var memberships = await membershipResolver.ListForUserAsync(userId, CancellationToken.None);
            if (memberships.Any(m => m.IsActive && m.Permissions.Contains(requirement.Permission)))
            {
                context.Succeed(requirement);
            }
        }
    }
}
