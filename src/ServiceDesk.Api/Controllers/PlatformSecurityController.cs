using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ServiceDesk.Api.Security;
using ServiceDesk.Application.Platform;
using ServiceDesk.Application.Security;

namespace ServiceDesk.Api.Controllers;

[ApiController]
[PlatformEndpoint]
[Route("api/v1/admin/security/password-policy")]
public sealed class PlatformSecurityController(
    IPasswordPolicyService passwordPolicyService,
    IPlatformContextAccessor platformContextAccessor) : ControllerBase
{
    [HttpGet]
    [Authorize(Policy = Permissions.PlatformSupport)]
    public async Task<ActionResult<PasswordPolicyResponse>> GetPolicy(CancellationToken cancellationToken)
    {
        var policy = await passwordPolicyService.GetCurrentPolicyAsync(cancellationToken).ConfigureAwait(false);
        return Ok(policy);
    }

    [HttpPut]
    [Authorize(Policy = Permissions.PlatformOperationsAdmin)]
    public async Task<IActionResult> UpdatePolicy(
        [FromBody] UpdatePasswordPolicyRequest request,
        CancellationToken cancellationToken)
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

        try
        {
            var updated = await passwordPolicyService.UpdatePolicyAsync(
                request,
                current.OperatorUserId,
                cancellationToken).ConfigureAwait(false);
            return Ok(updated);
        }
        catch (AuthRuleException ex)
        {
            return Problem(
                statusCode: 400,
                title: "Validation error",
                detail: ex.Message,
                extensions: new Dictionary<string, object?> { ["code"] = ex.Code });
        }
    }
}
