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

    // ─── Platform SMTP Settings ───────────────────────────────────────────────

    [HttpGet("smtp")]
    [Authorize(Policy = Permissions.PlatformOperationsAdmin)]
    public ActionResult<PlatformSmtpSettingsResponse> GetPlatformSmtp(
        [FromServices] Microsoft.Extensions.Configuration.IConfiguration configuration)
    {
        return Ok(new PlatformSmtpSettingsResponse(
            Host: configuration["PlatformSmtp:Host"] ?? "",
            Port: int.TryParse(configuration["PlatformSmtp:Port"], out var p) ? p : 587,
            Username: configuration["PlatformSmtp:Username"] ?? "",
            FromEmail: configuration["PlatformSmtp:FromEmail"] ?? "",
            FromName: configuration["PlatformSmtp:FromName"] ?? "ServiceDesk",
            EnableSsl: bool.TryParse(configuration["PlatformSmtp:EnableSsl"], out var ssl) ? ssl : true,
            IsConfigured: !string.IsNullOrWhiteSpace(configuration["PlatformSmtp:Host"])
        ));
    }

    [HttpPut("smtp")]
    [Authorize(Policy = Permissions.PlatformOperationsAdmin)]
    public IActionResult SavePlatformSmtp(
        [FromBody] SavePlatformSmtpRequest request,
        [FromServices] Microsoft.Extensions.Configuration.IConfigurationRoot? configRoot)
    {
        // In production, these should be written to environment variables or secrets manager.
        // For development with appsettings.Development.json, we write back via in-memory config.
        // The API MUST be restarted after save for changes to take effect (standard config pattern).
        if (string.IsNullOrWhiteSpace(request.Host))
            return Problem(statusCode: 400, title: "Validation failed",
                detail: "Host is required.", extensions: new Dictionary<string, object?> { ["code"] = "validation_failed" });

        if (string.IsNullOrWhiteSpace(request.FromEmail) || !request.FromEmail.Contains('@'))
            return Problem(statusCode: 400, title: "Validation failed",
                detail: "A valid From Email is required.", extensions: new Dictionary<string, object?> { ["code"] = "validation_failed" });

        // Write to appsettings.Development.json
        var settingsPath = Path.Combine(AppContext.BaseDirectory, "appsettings.Development.json");
        if (!System.IO.File.Exists(settingsPath))
            settingsPath = Path.Combine(Directory.GetCurrentDirectory(), "appsettings.Development.json");

        if (System.IO.File.Exists(settingsPath))
        {
            var json = System.IO.File.ReadAllText(settingsPath);
            var doc = System.Text.Json.JsonDocument.Parse(json);
            var dict = System.Text.Json.JsonSerializer.Deserialize<Dictionary<string, object>>(json) ?? [];

            dict["PlatformSmtp"] = new
            {
                Host = request.Host,
                Port = request.Port <= 0 ? 587 : request.Port,
                Username = request.Username ?? "",
                Password = request.Password ?? "",
                FromEmail = request.FromEmail,
                FromName = string.IsNullOrWhiteSpace(request.FromName) ? "ServiceDesk" : request.FromName,
                EnableSsl = request.EnableSsl,
            };

            System.IO.File.WriteAllText(settingsPath,
                System.Text.Json.JsonSerializer.Serialize(dict, IndentedJsonOptions));
        }

        return NoContent();
    }

    private static readonly System.Text.Json.JsonSerializerOptions IndentedJsonOptions = new() { WriteIndented = true };

    [HttpPost("smtp/test")]
    [Authorize(Policy = Permissions.PlatformOperationsAdmin)]
    public async Task<ActionResult<PlatformSmtpTestResult>> TestPlatformSmtp(
        [FromBody] TestPlatformSmtpRequest request,
        [FromServices] ServiceDesk.Infrastructure.Notifications.IEmailSender emailSender,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.TargetEmail) || !request.TargetEmail.Contains('@'))
            return Problem(statusCode: 400, title: "Validation failed",
                detail: "A valid target email address is required.", extensions: new Dictionary<string, object?> { ["code"] = "validation_failed" });

        try
        {
            await emailSender.SendTestEmailAsync(
                request.Host, request.Port <= 0 ? 587 : request.Port,
                request.Username ?? "", request.Password ?? "",
                request.FromEmail, request.FromName ?? "ServiceDesk",
                request.EnableSsl, request.TargetEmail, cancellationToken);

            return Ok(new PlatformSmtpTestResult(true, $"Test email sent successfully to {request.TargetEmail}."));
        }
        catch (Exception ex)
        {
            return Ok(new PlatformSmtpTestResult(false, $"SMTP connection failed: {ex.Message}"));
        }
    }
}

// ─── Platform SMTP contracts ──────────────────────────────────────────────────

public sealed record PlatformSmtpSettingsResponse(
    string Host, int Port, string Username,
    string FromEmail, string FromName, bool EnableSsl, bool IsConfigured);

public sealed record SavePlatformSmtpRequest(
    string Host, int Port, string? Username, string? Password,
    string FromEmail, string? FromName, bool EnableSsl);

public sealed record TestPlatformSmtpRequest(
    string Host, int Port, string? Username, string? Password,
    string FromEmail, string? FromName, bool EnableSsl, string TargetEmail);

public sealed record PlatformSmtpTestResult(bool Success, string Message);

