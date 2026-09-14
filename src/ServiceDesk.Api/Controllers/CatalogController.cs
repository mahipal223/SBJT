using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ServiceDesk.Application.Security;
using ServiceDesk.Application.Work;

namespace ServiceDesk.Api.Controllers;

[ApiController]
[Route("api/v1/businesses/{businessId:guid}/catalog-items")]
public sealed class CatalogController(IWorkStore store) : ControllerBase
{
    [HttpGet]
    [Authorize(Policy = Permissions.CatalogRead)]
    public async Task<ActionResult<PageResult<CatalogItemRecord>>> List(Guid businessId, [FromQuery] string? search, [FromQuery] string? itemType, [FromQuery] int page = 1, [FromQuery] int pageSize = 50, CancellationToken cancellationToken = default)
        => Ok(await store.ListCatalogItemsAsync(businessId, search, itemType, page, pageSize, cancellationToken));

    [HttpPost]
    [Authorize(Policy = Permissions.CatalogWrite)]
    public async Task<ActionResult<CatalogItemRecord>> Create(Guid businessId, CreateCatalogItemCommand command, CancellationToken cancellationToken)
    {
        try { return StatusCode(StatusCodes.Status201Created, await store.CreateCatalogItemAsync(businessId, command, cancellationToken)); }
        catch (WorkRuleException ex) { return BadRequest(ToProblem(ex, 400)); }
    }

    private object ToProblem(WorkRuleException ex, int status) => new { type = $"https://api.servicedesk.example/problems/{ex.Code}", title = "Request failed", status, detail = ex.Message, code = ex.Code, traceId = HttpContext.TraceIdentifier };
}
