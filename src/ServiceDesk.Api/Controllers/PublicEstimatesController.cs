using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ServiceDesk.Application.Financials;

namespace ServiceDesk.Api.Controllers;

[ApiController]
[AllowAnonymous]
[Route("api/v1/public/estimates/{token}")]
public sealed class PublicEstimatesController(IFinancialService financialService) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<PublicEstimateRecord>> Get(
        string token,
        CancellationToken cancellationToken)
    {
        try
        {
            return Ok(await financialService.GetPublicEstimateAsync(token, cancellationToken));
        }
        catch (FinancialRuleException exception)
        {
            return FinancialProblem(exception);
        }
    }

    [HttpPost("decision")]
    public async Task<ActionResult<EstimateDecisionRecord>> Decide(
        string token,
        EstimateDecisionCommand command,
        CancellationToken cancellationToken)
    {
        try
        {
            return Ok(await financialService.DecidePublicEstimateAsync(token, command, cancellationToken));
        }
        catch (FinancialRuleException exception)
        {
            return FinancialProblem(exception);
        }
    }

    private ObjectResult FinancialProblem(FinancialRuleException exception)
    {
        var status = exception.Code switch
        {
            "resource_not_found" => StatusCodes.Status404NotFound,
            "invalid_transition" or "decision_already_recorded" => StatusCodes.Status409Conflict,
            "estimate_expired" => StatusCodes.Status410Gone,
            _ => StatusCodes.Status400BadRequest
        };
        return StatusCode(status, new
        {
            type = $"https://api.servicedesk.example/problems/{exception.Code}",
            title = "Estimate request failed",
            status,
            detail = exception.Message,
            code = exception.Code,
            traceId = HttpContext.TraceIdentifier
        });
    }
}
