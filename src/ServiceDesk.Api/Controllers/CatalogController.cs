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

    [HttpGet("{catalogItemId:guid}")]
    [Authorize(Policy = Permissions.CatalogRead)]
    public async Task<ActionResult<CatalogItemRecord>> Get(Guid businessId, Guid catalogItemId, CancellationToken cancellationToken)
    {
        var item = await store.GetCatalogItemAsync(businessId, catalogItemId, cancellationToken);
        return item is not null ? Ok(item) : NotFound(ToProblem("resource_not_found", "The requested catalog item was not found.", 404));
    }

    [HttpPost]
    [Authorize(Policy = Permissions.CatalogWrite)]
    public async Task<ActionResult<CatalogItemRecord>> Create(Guid businessId, CreateCatalogItemCommand command, CancellationToken cancellationToken)
    {
        try { return StatusCode(StatusCodes.Status201Created, await store.CreateCatalogItemAsync(businessId, command, cancellationToken)); }
        catch (WorkRuleException ex) { return BadRequest(ToProblem(ex, 400)); }
    }

    [HttpPut("{catalogItemId:guid}")]
    [HttpPatch("{catalogItemId:guid}")]
    [Authorize(Policy = Permissions.CatalogWrite)]
    public async Task<ActionResult<CatalogItemRecord>> Update(Guid businessId, Guid catalogItemId, UpdateCatalogItemCommand command, CancellationToken cancellationToken)
    {
        try { return Ok(await store.UpdateCatalogItemAsync(businessId, catalogItemId, command, cancellationToken)); }
        catch (WorkRuleException ex) when (ex.Code == "resource_not_found") { return NotFound(ToProblem(ex, 404)); }
        catch (WorkRuleException ex) { return BadRequest(ToProblem(ex, 400)); }
    }

    [HttpPost("{catalogItemId:guid}/archive")]
    [HttpDelete("{catalogItemId:guid}")]
    [Authorize(Policy = Permissions.CatalogWrite)]
    public async Task<IActionResult> Archive(Guid businessId, Guid catalogItemId, CancellationToken cancellationToken)
    {
        try
        {
            await store.ArchiveCatalogItemAsync(businessId, catalogItemId, cancellationToken);
            return NoContent();
        }
        catch (WorkRuleException ex) when (ex.Code == "resource_not_found") { return NotFound(ToProblem(ex, 404)); }
        catch (WorkRuleException ex) { return BadRequest(ToProblem(ex, 400)); }
    }

    private object ToProblem(WorkRuleException ex, int status) => ToProblem(ex.Code, ex.Message, status);
    private object ToProblem(string code, string detail, int status) => new { type = $"https://api.servicedesk.example/problems/{code}", title = "Request failed", status, detail, code, traceId = HttpContext.TraceIdentifier };
}
