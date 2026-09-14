using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ServiceDesk.Application.Reports;
using ServiceDesk.Application.Security;

namespace ServiceDesk.Api.Controllers;

[ApiController]
[Route("api/v1/businesses/{businessId:guid}")]
public sealed class ReportsController(IReportService reportService) : ControllerBase
{
    [HttpGet("dashboard/summary")]
    [Authorize(Policy = Permissions.WorkspaceRead)]
    public async Task<ActionResult<DashboardSummaryResponse>> GetDashboardSummary(
        Guid businessId,
        CancellationToken cancellationToken)
    {
        var summary = await reportService.GetDashboardSummaryAsync(businessId, cancellationToken);
        return Ok(summary);
    }

    [HttpGet("reports/summary")]
    [Authorize(Policy = Permissions.ReportsRead)]
    public async Task<ActionResult<BusinessReportResponse>> GetBusinessReport(
        Guid businessId,
        [FromQuery] DateOnly? fromDate,
        [FromQuery] DateOnly? toDate,
        CancellationToken cancellationToken)
    {
        var report = await reportService.GetBusinessReportAsync(businessId, fromDate, toDate, cancellationToken);
        return Ok(report);
    }
}
