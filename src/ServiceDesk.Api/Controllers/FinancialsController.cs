using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ServiceDesk.Application.Abstractions;
using ServiceDesk.Application.Financials;
using ServiceDesk.Application.Security;
using ServiceDesk.Infrastructure.Services;

namespace ServiceDesk.Api.Controllers;

[ApiController]
[Route("api/v1/businesses/{businessId:guid}")]
public sealed class FinancialsController(
    IFinancialService financialService,
    IIdempotencyService idempotencyService,
    ITenantContextAccessor tenantContextAccessor) : ControllerBase
{
    [HttpGet("estimates")]
    [Authorize(Policy = Permissions.EstimatesManage)]
    public async Task<ActionResult<IReadOnlyList<EstimateRecord>>> ListEstimates(
        Guid businessId,
        [FromQuery] string? status,
        CancellationToken cancellationToken) =>
        Ok(await financialService.ListEstimatesAsync(businessId, status, cancellationToken));

    [HttpGet("estimates/{estimateId:guid}")]
    [Authorize(Policy = Permissions.EstimatesManage)]
    public async Task<ActionResult<EstimateRecord>> GetEstimate(
        Guid businessId,
        Guid estimateId,
        CancellationToken cancellationToken)
    {
        try
        {
            return Ok(await financialService.GetEstimateAsync(businessId, estimateId, cancellationToken));
        }
        catch (FinancialRuleException exception)
        {
            return FinancialProblem(exception);
        }
    }

    [HttpGet("estimates/{estimateId:guid}/pdf")]
    [Authorize(Policy = Permissions.EstimatesManage)]
    public async Task<IActionResult> GetEstimatePdf(
        Guid businessId,
        Guid estimateId,
        CancellationToken cancellationToken)
    {
        try
        {
            var pdf = await financialService.GetEstimatePdfAsync(businessId, estimateId, cancellationToken);
            return File(pdf.Content, pdf.ContentType, pdf.FileName);
        }
        catch (FinancialRuleException exception)
        {
            return FinancialProblem(exception);
        }
    }

    [HttpPost("jobs/{jobId:guid}/estimates")]
    [Authorize(Policy = Permissions.EstimatesManage)]
    public async Task<ActionResult<EstimateRecord>> CreateEstimate(
        Guid businessId,
        Guid jobId,
        CreateEstimateCommand command,
        CancellationToken cancellationToken)
    {
        try
        {
            var estimate = await financialService.CreateEstimateAsync(businessId, jobId, command, cancellationToken);
            return StatusCode(StatusCodes.Status201Created, estimate);
        }
        catch (FinancialRuleException exception)
        {
            return FinancialProblem(exception);
        }
    }

    [HttpPost("estimates/{estimateId:guid}/send")]
    [Authorize(Policy = Permissions.EstimatesManage)]
    public async Task<ActionResult<EstimateRecord>> SendEstimate(
        Guid businessId,
        Guid estimateId,
        CancellationToken cancellationToken)
    {
        try
        {
            var idempotencyKey = GetIdempotencyKey();
            if (idempotencyKey is not null)
            {
                var actorUserId = tenantContextAccessor.Current?.UserId ?? Guid.Empty;
                var check = await idempotencyService.CheckAsync(
                    businessId, actorUserId, $"Estimates.Send:{estimateId}", idempotencyKey, "", cancellationToken);

                if (check.HasCachedResponse && check.ResponseCode.HasValue)
                {
                    return StatusCode(check.ResponseCode.Value, JsonSerializer.Deserialize<EstimateRecord>(check.ResponseJson!));
                }
                if (check.IsInProgress)
                {
                    return StatusCode(StatusCodes.Status409Conflict, new { code = "idempotency_conflict", detail = "A request with this idempotency key is already in progress." });
                }

                var sent = await financialService.SendEstimateAsync(businessId, estimateId, cancellationToken);
                await idempotencyService.CompleteAsync(
                    businessId, actorUserId, $"Estimates.Send:{estimateId}", idempotencyKey, StatusCodes.Status200OK, JsonSerializer.Serialize(sent), cancellationToken);
                return Ok(sent);
            }

            return Ok(await financialService.SendEstimateAsync(businessId, estimateId, cancellationToken));
        }
        catch (FinancialRuleException exception)
        {
            return FinancialProblem(exception);
        }
    }

    [HttpPost("estimates/{estimateId:guid}/revise")]
    [Authorize(Policy = Permissions.EstimatesManage)]
    public async Task<ActionResult<EstimateRecord>> ReviseEstimate(
        Guid businessId,
        Guid estimateId,
        ReviseEstimateCommand command,
        CancellationToken cancellationToken)
    {
        try
        {
            var revision = await financialService.ReviseEstimateAsync(businessId, estimateId, command, cancellationToken);
            return StatusCode(StatusCodes.Status201Created, revision);
        }
        catch (FinancialRuleException exception)
        {
            return FinancialProblem(exception);
        }
    }

    [HttpPost("estimates/{estimateId:guid}/public-link")]
    [Authorize(Policy = Permissions.EstimatesManage)]
    public async Task<ActionResult<PublicEstimateLinkRecord>> CreatePublicEstimateLink(
        Guid businessId,
        Guid estimateId,
        CancellationToken cancellationToken)
    {
        try
        {
            return Ok(await financialService.CreatePublicEstimateLinkAsync(businessId, estimateId, cancellationToken));
        }
        catch (FinancialRuleException exception)
        {
            return FinancialProblem(exception);
        }
    }

    [HttpGet("invoices")]
    [Authorize(Policy = Permissions.InvoicesManage)]
    public async Task<ActionResult<IReadOnlyList<InvoiceRecord>>> ListInvoices(
        Guid businessId,
        [FromQuery] string? status,
        CancellationToken cancellationToken) =>
        Ok(await financialService.ListInvoicesAsync(businessId, status, cancellationToken));

    [HttpGet("invoices/{invoiceId:guid}")]
    [Authorize(Policy = Permissions.InvoicesManage)]
    public async Task<ActionResult<InvoiceRecord>> GetInvoice(
        Guid businessId,
        Guid invoiceId,
        CancellationToken cancellationToken)
    {
        try
        {
            return Ok(await financialService.GetInvoiceAsync(businessId, invoiceId, cancellationToken));
        }
        catch (FinancialRuleException exception)
        {
            return FinancialProblem(exception);
        }
    }

    [HttpGet("invoices/{invoiceId:guid}/pdf")]
    [Authorize(Policy = Permissions.InvoicesManage)]
    public async Task<IActionResult> GetInvoicePdf(
        Guid businessId,
        Guid invoiceId,
        CancellationToken cancellationToken)
    {
        try
        {
            var pdf = await financialService.GetInvoicePdfAsync(businessId, invoiceId, cancellationToken);
            return File(pdf.Content, pdf.ContentType, pdf.FileName);
        }
        catch (FinancialRuleException exception)
        {
            return FinancialProblem(exception);
        }
    }

    [HttpPost("jobs/{jobId:guid}/invoices")]
    [Authorize(Policy = Permissions.InvoicesManage)]
    public async Task<ActionResult<InvoiceRecord>> CreateInvoice(
        Guid businessId,
        Guid jobId,
        CancellationToken cancellationToken)
    {
        try
        {
            var invoice = await financialService.CreateInvoiceAsync(businessId, jobId, cancellationToken);
            return StatusCode(StatusCodes.Status201Created, invoice);
        }
        catch (FinancialRuleException exception)
        {
            return FinancialProblem(exception);
        }
    }

    [HttpPost("invoices/{invoiceId:guid}/issue")]
    [Authorize(Policy = Permissions.InvoicesManage)]
    public async Task<ActionResult<InvoiceRecord>> IssueInvoice(
        Guid businessId,
        Guid invoiceId,
        IssueInvoiceCommand command,
        CancellationToken cancellationToken)
    {
        try
        {
            var idempotencyKey = GetIdempotencyKey();
            if (idempotencyKey is not null)
            {
                var actorUserId = tenantContextAccessor.Current?.UserId ?? Guid.Empty;
                var payload = JsonSerializer.Serialize(command);
                var check = await idempotencyService.CheckAsync(
                    businessId, actorUserId, $"Invoices.Issue:{invoiceId}", idempotencyKey, payload, cancellationToken);

                if (check.HasCachedResponse && check.ResponseCode.HasValue)
                {
                    return StatusCode(check.ResponseCode.Value, JsonSerializer.Deserialize<InvoiceRecord>(check.ResponseJson!));
                }
                if (check.IsInProgress)
                {
                    return StatusCode(StatusCodes.Status409Conflict, new { code = "idempotency_conflict", detail = "A request with this idempotency key is already in progress." });
                }

                var issued = await financialService.IssueInvoiceAsync(businessId, invoiceId, command, cancellationToken);
                await idempotencyService.CompleteAsync(
                    businessId, actorUserId, $"Invoices.Issue:{invoiceId}", idempotencyKey, StatusCodes.Status200OK, JsonSerializer.Serialize(issued), cancellationToken);
                return Ok(issued);
            }

            return Ok(await financialService.IssueInvoiceAsync(businessId, invoiceId, command, cancellationToken));
        }
        catch (FinancialRuleException exception)
        {
            return FinancialProblem(exception);
        }
    }

    [HttpPost("invoices/{invoiceId:guid}/payments")]
    [Authorize(Policy = Permissions.PaymentsManage)]
    public async Task<ActionResult<PaymentRecord>> RecordPayment(
        Guid businessId,
        Guid invoiceId,
        RecordPaymentCommand command,
        CancellationToken cancellationToken)
    {
        try
        {
            var idempotencyKey = GetIdempotencyKey();
            if (idempotencyKey is not null)
            {
                var actorUserId = tenantContextAccessor.Current?.UserId ?? Guid.Empty;
                var payload = JsonSerializer.Serialize(command);
                var check = await idempotencyService.CheckAsync(
                    businessId, actorUserId, $"Payments.Record:{invoiceId}", idempotencyKey, payload, cancellationToken);

                if (check.HasCachedResponse && check.ResponseCode.HasValue)
                {
                    return StatusCode(check.ResponseCode.Value, JsonSerializer.Deserialize<PaymentRecord>(check.ResponseJson!));
                }
                if (check.IsInProgress)
                {
                    return StatusCode(StatusCodes.Status409Conflict, new { code = "idempotency_conflict", detail = "A request with this idempotency key is already in progress." });
                }

                var payment = await financialService.RecordPaymentAsync(businessId, invoiceId, command, cancellationToken);
                await idempotencyService.CompleteAsync(
                    businessId, actorUserId, $"Payments.Record:{invoiceId}", idempotencyKey, StatusCodes.Status201Created, JsonSerializer.Serialize(payment), cancellationToken);
                return StatusCode(StatusCodes.Status201Created, payment);
            }

            var result = await financialService.RecordPaymentAsync(businessId, invoiceId, command, cancellationToken);
            return StatusCode(StatusCodes.Status201Created, result);
        }
        catch (FinancialRuleException exception)
        {
            return FinancialProblem(exception);
        }
    }

    [HttpGet("settings/smtp")]
    [Authorize(Policy = Permissions.WorkspaceManage)]
    public async Task<ActionResult<SmtpSettingsRecord>> GetSmtpSettings(
        Guid businessId,
        CancellationToken cancellationToken) =>
        Ok(await financialService.GetSmtpSettingsAsync(businessId, cancellationToken));

    [HttpPut("settings/smtp")]
    [Authorize(Policy = Permissions.WorkspaceManage)]
    public async Task<ActionResult<SmtpSettingsRecord>> SaveSmtpSettings(
        Guid businessId,
        SaveSmtpSettingsCommand command,
        CancellationToken cancellationToken)
    {
        try
        {
            return Ok(await financialService.SaveSmtpSettingsAsync(businessId, command, cancellationToken));
        }
        catch (FinancialRuleException exception)
        {
            return FinancialProblem(exception);
        }
    }

    [HttpPost("settings/smtp/test")]
    [Authorize(Policy = Permissions.WorkspaceManage)]
    public async Task<ActionResult<TestSmtpConnectionResult>> TestSmtpSettings(
        Guid businessId,
        TestSmtpConnectionCommand command,
        CancellationToken cancellationToken)
    {
        try
        {
            return Ok(await financialService.TestSmtpSettingsAsync(businessId, command, cancellationToken));
        }
        catch (FinancialRuleException exception)
        {
            return FinancialProblem(exception);
        }
    }

    private string? GetIdempotencyKey()
    {
        if (Request.Headers.TryGetValue("Idempotency-Key", out var headerValue))
        {
            var key = headerValue.ToString().Trim();
            return string.IsNullOrWhiteSpace(key) ? null : key;
        }
        return null;
    }

    private ObjectResult FinancialProblem(FinancialRuleException exception)
    {
        var status = exception.Code switch
        {
            "resource_not_found" => StatusCodes.Status404NotFound,
            "feature_not_available" => StatusCodes.Status403Forbidden,
            "invoice_already_exists" or "invalid_transition" or "invoice_not_issued" or "decision_already_recorded" => StatusCodes.Status409Conflict,
            "job_not_completed" or "job_items_required" or "estimate_items_required" or "estimate_expired" or "overpayment" or "smtp_not_configured" or "validation_failed" => StatusCodes.Status422UnprocessableEntity,
            _ => StatusCodes.Status400BadRequest
        };
        return StatusCode(status, new
        {
            type = $"https://api.servicedesk.example/problems/{exception.Code}",
            title = "Financial request failed",
            status,
            detail = exception.Message,
            code = exception.Code,
            traceId = HttpContext.TraceIdentifier
        });
    }
}
