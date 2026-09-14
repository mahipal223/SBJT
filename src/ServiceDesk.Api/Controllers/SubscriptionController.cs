using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ServiceDesk.Application.Abstractions;
using ServiceDesk.Application.Security;
using ServiceDesk.Application.Subscriptions;

namespace ServiceDesk.Api.Controllers;

[ApiController]
[Route("api/v1/businesses/{businessId:guid}/subscription")]
[Authorize(Policy = Permissions.SubscriptionManage)]
public sealed class SubscriptionController(
    ISubscriptionService subscriptionService,
    ITenantContextAccessor tenantContextAccessor) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<SubscriptionOverviewRecord>> GetOverview(
        Guid businessId,
        CancellationToken cancellationToken)
    {
        try
        {
            var overview = await subscriptionService.GetOverviewAsync(businessId, cancellationToken);
            return Ok(overview);
        }
        catch (SubscriptionRuleException ex)
        {
            return Problem(
                statusCode: StatusCodes.Status400BadRequest,
                title: "Subscription request failed",
                detail: ex.Message,
                extensions: new Dictionary<string, object?> { ["code"] = ex.Code });
        }
    }

    [HttpGet("plans")]
    [AllowAnonymous]
    public async Task<ActionResult<IReadOnlyList<PlanRecord>>> GetPublishedPlans(
        Guid businessId,
        CancellationToken cancellationToken)
    {
        var plans = await subscriptionService.GetPublishedPlansAsync(cancellationToken);
        return Ok(plans);
    }

    [HttpPost("change-plan")]
    public async Task<ActionResult<ChangePlanResult>> ChangePlan(
        Guid businessId,
        ChangePlanCommand command,
        CancellationToken cancellationToken)
    {
        try
        {
            var actorUserId = tenantContextAccessor.Current?.UserId ?? Guid.Empty;
            var result = await subscriptionService.ChangePlanAsync(businessId, actorUserId, command, cancellationToken);
            return Ok(result);
        }
        catch (SubscriptionRuleException ex)
        {
            return Problem(
                statusCode: StatusCodes.Status400BadRequest,
                title: "Plan change failed",
                detail: ex.Message,
                extensions: new Dictionary<string, object?> { ["code"] = ex.Code });
        }
    }

    [HttpPost("simulate-event")]
    public async Task<ActionResult<SubscriptionRecord>> SimulateBillingEvent(
        Guid businessId,
        SimulateBillingEventCommand command,
        CancellationToken cancellationToken)
    {
        try
        {
            var actorUserId = tenantContextAccessor.Current?.UserId ?? Guid.Empty;
            var result = await subscriptionService.SimulateBillingEventAsync(businessId, actorUserId, command, cancellationToken);
            return Ok(result);
        }
        catch (SubscriptionRuleException ex)
        {
            return Problem(
                statusCode: StatusCodes.Status400BadRequest,
                title: "Simulation failed",
                detail: ex.Message,
                extensions: new Dictionary<string, object?> { ["code"] = ex.Code });
        }
    }
}
