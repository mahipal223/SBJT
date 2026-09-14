using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ServiceDesk.Application.Abstractions;
using ServiceDesk.Application.Security;
using ServiceDesk.Application.Tenancy;

namespace ServiceDesk.Api.Controllers;

[ApiController]
[Route("api/v1/businesses/{businessId:guid}/workspace")]
public sealed class WorkspaceController(
    ITenantContextAccessor tenantContextAccessor,
    IBusinessService businessService) : ControllerBase
{
    /// <summary>
    /// Returns the current user's workspace membership and business profile details.
    /// </summary>
    [HttpGet]
    [Authorize(Policy = Permissions.WorkspaceRead)]
    public async Task<IActionResult> Get(Guid businessId, CancellationToken cancellationToken)
    {
        var tenant = tenantContextAccessor.Current!;
        var business = await businessService.GetAsync(businessId, cancellationToken);

        return Ok(new
        {
            businessId,
            businessName = business?.Name ?? "Workspace",
            tenant.MemberId,
            tenant.UserId,
            role = tenant.Role.ToString(),
            permissions = tenant.Permissions.Order(),
            business
        });
    }
}
