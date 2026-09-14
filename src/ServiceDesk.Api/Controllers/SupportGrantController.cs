using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ServiceDesk.Application.Abstractions;
using ServiceDesk.Application.Platform;
using ServiceDesk.Application.Security;

namespace ServiceDesk.Api.Controllers;

[ApiController]
[Route("api/v1/businesses/{businessId:guid}/support-grants")]
[Authorize(Policy = Permissions.SupportApprove)]
public sealed class SupportGrantController(
    IPlatformAdminService platformAdmin,
    ITenantContextAccessor tenantContextAccessor) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<SupportGrantResponse>>> GetSupportGrants(
        Guid businessId,
        CancellationToken cancellationToken)
    {
        var grants = await platformAdmin.GetSupportGrantsAsync(businessId, cancellationToken);
        return Ok(grants);
    }

    [HttpPost]
    public async Task<ActionResult<SupportGrantResponse>> CreateSupportGrant(
        Guid businessId,
        CreateSupportGrantRequest request,
        CancellationToken cancellationToken)
    {
        var ctx = tenantContextAccessor.Current;
        if (ctx is null)
        {
            return Unauthorized();
        }

        var grant = await platformAdmin.CreateSupportGrantAsync(
            businessId,
            ctx.UserId,
            ctx.MemberId,
            request,
            cancellationToken);

        return CreatedAtAction(nameof(GetSupportGrants), new { businessId }, grant);
    }

    [HttpPost("{grantId:guid}/revoke")]
    public async Task<IActionResult> RevokeSupportGrant(
        Guid businessId,
        Guid grantId,
        CancellationToken cancellationToken)
    {
        var ctx = tenantContextAccessor.Current;
        await platformAdmin.RevokeSupportGrantAsync(
            businessId, grantId,
            ctx?.UserId ?? Guid.Empty,
            cancellationToken);
        return NoContent();
    }
}
