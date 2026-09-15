using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ServiceDesk.Api.Security;
using ServiceDesk.Application.Platform;
using ServiceDesk.Application.Security;

namespace ServiceDesk.Api.Controllers;

/// <summary>
/// Platform administration endpoints — control-plane operations restricted to platform administrators.
/// Route prefix: /api/v1/admin  (no businessId — these are cross-tenant).
/// </summary>
[ApiController]
[PlatformEndpoint]
[Route("api/v1/admin")]
public sealed class PlatformAdminController(
    IPlatformAdminService platformAdmin,
    IPlatformContextAccessor platformContextAccessor) : ControllerBase
{
    // ─── Current operator ───────────────────────────────────────────────────

    [HttpGet("me")]
    [Authorize(Policy = Permissions.PlatformSupport)]
    public ActionResult<PlatformOperatorResponse> GetCurrentOperator()
    {
        var current = platformContextAccessor.Current;
        if (current is null)
        {
            return Problem(
                statusCode: 403,
                title: "Forbidden",
                detail: "Platform administrator access denied.",
                extensions: new Dictionary<string, object?> { ["code"] = "forbidden" });
        }

        return Ok(new PlatformOperatorResponse(
            current.OperatorUserId,
            current.FullName,
            current.Email,
            current.RoleCode,
            current.Permissions.ToList()));
    }

    // ─── Businesses ─────────────────────────────────────────────────────────

    [HttpGet("businesses")]
    [Authorize(Policy = Permissions.PlatformSupport)]
    public async Task<ActionResult<IReadOnlyList<PlatformBusinessSummaryResponse>>> GetBusinesses(
        [FromQuery] string? search,
        [FromQuery] string? status,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 25,
        CancellationToken cancellationToken = default)
    {
        var results = await platformAdmin.GetBusinessesAsync(search, status, page, pageSize, cancellationToken);
        return Ok(results);
    }

    [HttpGet("businesses/{businessId:guid}")]
    [Authorize(Policy = Permissions.PlatformSupport)]
    public async Task<ActionResult<PlatformBusinessSummaryResponse>> GetBusiness(
        Guid businessId,
        CancellationToken cancellationToken)
    {
        var result = await platformAdmin.GetBusinessAsync(businessId, cancellationToken);
        if (result is null)
        {
            return Problem(statusCode: 404, title: "Resource not found", detail: "Business not found.", extensions: new Dictionary<string, object?> { ["code"] = "resource_not_found" });
        }

        return Ok(result);
    }

    [HttpPatch("businesses/{businessId:guid}/status")]
    [Authorize(Policy = Permissions.PlatformOperationsAdmin)]
    public async Task<IActionResult> UpdateBusinessStatus(
        Guid businessId,
        UpdateBusinessStatusRequest request,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Reason))
        {
            return Problem(statusCode: 400, title: "Validation failed", detail: "A reason is required when changing business status.", extensions: new Dictionary<string, object?> { ["code"] = "validation_failed" });
        }

        var actorUserId = platformContextAccessor.Current?.OperatorUserId ?? Guid.Empty;
        await platformAdmin.UpdateBusinessStatusAsync(businessId, actorUserId, request, cancellationToken);
        return NoContent();
    }

    // ─── Metrics ────────────────────────────────────────────────────────────

    [HttpGet("metrics")]
    [Authorize(Policy = Permissions.PlatformOperationsAdmin)]
    public async Task<ActionResult<PlatformMetricsResponse>> GetMetrics(CancellationToken cancellationToken)
    {
        var metrics = await platformAdmin.GetMetricsAsync(cancellationToken);
        return Ok(metrics);
    }

    // ─── Plans ───────────────────────────────────────────────────────────────

    [HttpGet("plans")]
    [Authorize(Policy = Permissions.PlatformBillingAdmin)]
    public async Task<ActionResult<IReadOnlyList<PlatformPlanDetailResponse>>> GetPlans(
        CancellationToken cancellationToken)
    {
        var plans = await platformAdmin.GetPlansAsync(cancellationToken);
        return Ok(plans);
    }

    [HttpPost("plans")]
    [Authorize(Policy = Permissions.PlatformBillingAdmin)]
    public async Task<ActionResult<PlatformPlanDetailResponse>> CreatePlan(
        CreatePlatformPlanRequest request,
        CancellationToken cancellationToken)
    {
        var actorUserId = platformContextAccessor.Current?.OperatorUserId ?? Guid.Empty;
        var plan = await platformAdmin.CreatePlanAsync(actorUserId, request, cancellationToken);
        return CreatedAtAction(nameof(GetPlans), plan);
    }

    // ─── Backups & Restores ──────────────────────────────────────────────────

    [HttpGet("backups")]
    [Authorize(Policy = Permissions.PlatformOperationsAdmin)]
    public async Task<ActionResult<IReadOnlyList<BackupRunResponse>>> GetBackupRuns(
        [FromQuery] int limit = 20,
        CancellationToken cancellationToken = default)
    {
        var runs = await platformAdmin.GetBackupRunsAsync(limit, cancellationToken);
        return Ok(runs);
    }

    [HttpPost("restores")]
    [Authorize(Policy = Permissions.PlatformOperationsAdmin)]
    public async Task<ActionResult<RestoreRunResponse>> CreateRestoreRun(
        CreateRestoreRequest request,
        CancellationToken cancellationToken)
    {
        var actorUserId = platformContextAccessor.Current?.OperatorUserId ?? Guid.Empty;
        var restore = await platformAdmin.CreateRestoreRunAsync(actorUserId, request, cancellationToken);
        return CreatedAtAction(nameof(GetRestoreRun), new { restoreId = restore.Id }, restore);
    }

    [HttpGet("restores/{restoreId:guid}")]
    [Authorize(Policy = Permissions.PlatformOperationsAdmin)]
    public async Task<ActionResult<RestoreRunResponse>> GetRestoreRun(
        Guid restoreId,
        CancellationToken cancellationToken)
    {
        var restore = await platformAdmin.GetRestoreRunAsync(restoreId, cancellationToken);
        if (restore is null)
        {
            return Problem(statusCode: 404, title: "Resource not found", extensions: new Dictionary<string, object?> { ["code"] = "resource_not_found" });
        }

        return Ok(restore);
    }

    // ─── Platform Audit Events ────────────────────────────────────────────────

    [HttpGet("audit-events")]
    [Authorize(Policy = Permissions.PlatformOperationsAdmin)]
    public async Task<ActionResult<IReadOnlyList<PlatformAdminAuditEventResponse>>> GetAdminAuditEvents(
        [FromQuery] int limit = 50,
        CancellationToken cancellationToken = default)
    {
        var events = await platformAdmin.GetAdminAuditEventsAsync(limit, cancellationToken);
        return Ok(events);
    }
}
