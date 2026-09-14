using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ServiceDesk.Application.Security;
using ServiceDesk.Application.Tenancy;

namespace ServiceDesk.Api.Controllers;

public sealed record NotificationPreferencesDto(
    bool JobAssignedEmail,
    bool InvoiceIssuedEmail,
    bool PaymentReceivedEmail,
    bool DailyDigestEmail,
    string? AlertEmailRecipient);

[ApiController]
[Authorize]
[Route("api/v1/businesses/{businessId:guid}/notifications/preferences")]
public sealed class NotificationsController(IBusinessService businessService) : ControllerBase
{
    private static readonly NotificationPreferencesDto DefaultPreferences = new(
        JobAssignedEmail: true,
        InvoiceIssuedEmail: true,
        PaymentReceivedEmail: true,
        DailyDigestEmail: false,
        AlertEmailRecipient: null);

    [HttpGet]
    [Authorize(Policy = Permissions.WorkspaceRead)]
    public async Task<IActionResult> Get(Guid businessId, CancellationToken cancellationToken)
    {
        var business = await businessService.GetAsync(businessId, cancellationToken);
        if (business is null)
        {
            return NotFound(new
            {
                type = "https://api.servicedesk.example/problems/resource_not_found",
                title = "Resource not found",
                status = 404,
                detail = "The business workspace was not found.",
                code = "resource_not_found",
                traceId = HttpContext.TraceIdentifier
            });
        }

        return Ok(DefaultPreferences with { AlertEmailRecipient = business.BillingEmail });
    }

    [HttpPatch]
    [Authorize(Policy = Permissions.WorkspaceManage)]
    public async Task<IActionResult> Update(
        Guid businessId,
        [FromBody] NotificationPreferencesDto preferences,
        CancellationToken cancellationToken)
    {
        var business = await businessService.GetAsync(businessId, cancellationToken);
        if (business is null)
        {
            return NotFound(new
            {
                type = "https://api.servicedesk.example/problems/resource_not_found",
                title = "Resource not found",
                status = 404,
                detail = "The business workspace was not found.",
                code = "resource_not_found",
                traceId = HttpContext.TraceIdentifier
            });
        }

        return Ok(preferences);
    }
}
