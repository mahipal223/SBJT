using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ServiceDesk.Application.Abstractions;
using ServiceDesk.Application.DataControls;
using ServiceDesk.Application.Security;

namespace ServiceDesk.Api.Controllers;

[ApiController]
[Route("api/v1/businesses/{businessId:guid}/exports")]
[Authorize(Policy = Permissions.ExportsManage)]
public sealed class DataExportController(
    IDataExportService dataExportService,
    ITenantContextAccessor tenantContextAccessor) : ControllerBase
{
    [HttpPost]
    public async Task<ActionResult<ExportRequestResponse>> CreateExport(
        Guid businessId,
        [FromBody] CreateExportRequest request,
        CancellationToken cancellationToken)
    {
        var memberId = tenantContextAccessor.Current?.MemberId ?? Guid.Empty;
        var result = await dataExportService.CreateExportAsync(businessId, memberId, request, cancellationToken);
        return CreatedAtAction(nameof(ListExports), new { businessId }, result);
    }

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<ExportRequestResponse>>> ListExports(
        Guid businessId,
        CancellationToken cancellationToken)
    {
        var list = await dataExportService.ListExportsAsync(businessId, cancellationToken);
        return Ok(list);
    }

    [HttpGet("{exportId:guid}/download")]
    public async Task<IActionResult> DownloadExport(
        Guid businessId,
        Guid exportId,
        CancellationToken cancellationToken)
    {
        var package = await dataExportService.GetExportPackageAsync(businessId, exportId, cancellationToken);
        if (package is null)
        {
            return Problem(
                statusCode: StatusCodes.Status404NotFound,
                title: "resource_not_found",
                detail: "The requested export file was not found or has expired.",
                extensions: new Dictionary<string, object?> { ["code"] = "resource_not_found" });
        }

        return File(package.Content, package.ContentType, package.FileName);
    }
}
