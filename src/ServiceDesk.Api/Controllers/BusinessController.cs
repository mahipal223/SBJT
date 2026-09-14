using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ServiceDesk.Application.Security;
using ServiceDesk.Application.Tenancy;

namespace ServiceDesk.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/v1/businesses")]
public sealed class BusinessController(IBusinessService businessService) : ControllerBase
{
    /// <summary>
    /// Provisions a new tenant business workspace for the authenticated user.
    /// The user becomes the workspace Owner.
    /// </summary>
    [HttpPost]
    public async Task<IActionResult> Create(
        [FromBody] CreateBusinessCommand command,
        CancellationToken cancellationToken)
    {
        var subject = User.FindFirstValue(ClaimTypes.NameIdentifier)
                      ?? User.FindFirstValue("sub");

        if (string.IsNullOrWhiteSpace(subject))
        {
            return Problem(
                detail: "A valid user subject claim was not found in the token.",
                statusCode: 401,
                title: "Authentication required");
        }

        var email = User.FindFirstValue(ClaimTypes.Email)
                    ?? User.FindFirstValue("email")
                    ?? string.Empty;

        var fullName = User.FindFirstValue(ClaimTypes.Name)
                       ?? User.FindFirstValue("name")
                       ?? string.Empty;

        var userId = UserIdentityUtilities.DeriveUserId(subject);

        var result = await businessService.CreateAsync(
            userId,
            subject,
            email,
            fullName,
            command,
            cancellationToken);

        return Created($"/api/v1/businesses/{result.Id}", new
        {
            businessId = result.Id,
            businessName = result.Name,
            business = result
        });
    }

    /// <summary>
    /// Gets the business profile and configuration for the specified workspace.
    /// </summary>
    [HttpGet("{businessId:guid}")]
    [Authorize(Policy = Permissions.WorkspaceRead)]
    public async Task<IActionResult> Get(
        Guid businessId,
        CancellationToken cancellationToken)
    {
        var result = await businessService.GetAsync(businessId, cancellationToken);
        if (result is null)
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

        return Ok(result);
    }

    /// <summary>
    /// Updates settings and profile for the specified workspace.
    /// </summary>
    [HttpPatch("{businessId:guid}")]
    [Authorize(Policy = Permissions.WorkspaceManage)]
    public async Task<IActionResult> Update(
        Guid businessId,
        [FromBody] UpdateBusinessCommand command,
        CancellationToken cancellationToken)
    {
        var result = await businessService.UpdateAsync(businessId, command, cancellationToken);
        if (result is null)
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

        return Ok(result);
    }
}
