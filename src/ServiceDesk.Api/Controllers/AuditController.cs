using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ServiceDesk.Application.DataControls;
using ServiceDesk.Application.Security;

namespace ServiceDesk.Api.Controllers;

[ApiController]
[Route("api/v1/businesses/{businessId:guid}/audit-events")]
[Authorize(Policy = Permissions.AuditRead)]
public sealed class AuditController(IAuditService auditService) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<AuditEventResponse>>> ListAuditEvents(
        Guid businessId,
        [FromQuery] int limit = 50,
        CancellationToken cancellationToken = default)
    {
        var events = await auditService.ListAuditEventsAsync(businessId, limit, cancellationToken);
        return Ok(events);
    }
}
