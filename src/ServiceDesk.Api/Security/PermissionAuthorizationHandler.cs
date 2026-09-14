using Microsoft.AspNetCore.Authorization;
using ServiceDesk.Application.Abstractions;

namespace ServiceDesk.Api.Security;

public sealed class PermissionAuthorizationHandler(ITenantContextAccessor tenantContextAccessor)
    : AuthorizationHandler<PermissionRequirement>
{
    protected override Task HandleRequirementAsync(
        AuthorizationHandlerContext context,
        PermissionRequirement requirement)
    {
        if (tenantContextAccessor.Current?.HasPermission(requirement.Permission) == true)
        {
            context.Succeed(requirement);
        }

        return Task.CompletedTask;
    }
}
