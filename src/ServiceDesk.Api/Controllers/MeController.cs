using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ServiceDesk.Application.Abstractions;

namespace ServiceDesk.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/v1/me")]
public sealed class MeController(IMembershipResolver membershipResolver) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> Get(CancellationToken cancellationToken)
    {
        // Accept the Auth0 "sub" claim or the ClaimTypes.NameIdentifier equivalent.
        var rawSubject = User.FindFirstValue("sub")
                         ?? User.FindFirstValue(ClaimTypes.NameIdentifier);

        if (string.IsNullOrWhiteSpace(rawSubject))
        {
            return Problem(
                detail: "A valid user identifier claim was not found in the token.",
                statusCode: 401,
                title: "Authentication required");
        }

        Guid userId;
        try
        {
            userId = ServiceDesk.Application.Security.UserIdentityUtilities.DeriveUserId(rawSubject);
        }
        catch
        {
            return Problem(
                detail: "A valid user identifier could not be derived from the token subject.",
                statusCode: 401,
                title: "Authentication required");
        }

        // Read real name and email from Auth0 JWT claims when available.
        var email = User.FindFirstValue(ClaimTypes.Email)
                       ?? User.FindFirstValue("email")
                       ?? string.Empty;
        var fullName = User.FindFirstValue(ClaimTypes.Name)
                       ?? User.FindFirstValue("name")
                       ?? User.FindFirstValue("nickname")
                       ?? string.Empty;

        var memberships = await membershipResolver.ListForUserAsync(userId, cancellationToken);

        return Ok(new
        {
            id = userId,
            email,
            fullName,
            memberships = memberships.Select(membership => new
            {
                membership.BusinessId,
                membership.BusinessName,
                membership.MemberId,
                role = membership.Role.ToString(),
                status = membership.IsActive ? "Active" : "Inactive"
            })
        });
    }
}
