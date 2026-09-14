using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ServiceDesk.Application.Abstractions;

namespace ServiceDesk.Api.Controllers;

/// <summary>
/// Handles first-time user registration and business workspace provisioning
/// after a successful Auth0 login.
/// </summary>
[ApiController]
[Authorize]
[Route("api/v1/auth")]
public sealed class AuthController(IMembershipResolver membershipResolver) : ControllerBase
{
    /// <summary>
    /// Called once after the first Auth0 login to synchronise the OIDC user
    /// with the internal user table and create a business workspace when
    /// the user has none yet.
    /// </summary>
    /// <remarks>
    /// The frontend calls this after every Auth0 login callback.
    /// If the user already has a workspace, the existing membership is returned.
    /// Body is intentionally empty — all identity data comes from the JWT claims.
    /// </remarks>
    [HttpPost("sync-user")]
    public async Task<IActionResult> SyncUser(CancellationToken cancellationToken)
    {
        var subject = User.FindFirstValue(ClaimTypes.NameIdentifier)
                      ?? User.FindFirstValue("sub");

        if (string.IsNullOrWhiteSpace(subject))
        {
            return Problem(
                detail: "The access token does not contain a valid subject claim.",
                statusCode: 401,
                title: "Authentication required");
        }

        var email = User.FindFirstValue(ClaimTypes.Email)
                       ?? User.FindFirstValue("email")
                       ?? string.Empty;
        var fullName = User.FindFirstValue(ClaimTypes.Name)
                       ?? User.FindFirstValue("name")
                       ?? string.Empty;

        // Derive a deterministic userId from the Auth0 subject.
        var userId = ServiceDesk.Application.Security.UserIdentityUtilities.DeriveUserId(subject);

        // Check whether this user already belongs to any active workspace.
        var memberships = await membershipResolver.ListForUserAsync(userId, cancellationToken);
        var activeMembership = memberships.FirstOrDefault(m => m.IsActive);

        if (activeMembership is not null)
        {
            return Ok(new
            {
                userId,
                email,
                fullName,
                status = "existing",
                businessId = activeMembership.BusinessId,
                businessName = activeMembership.BusinessName,
                role = activeMembership.Role.ToString()
            });
        }

        // New user — they need to complete the onboarding wizard.
        // The business workspace will be created when the wizard is submitted
        // via POST /api/v1/businesses.
        return Ok(new
        {
            userId,
            email,
            fullName,
            status = "new_user",
            businessId = (Guid?)null,
            businessName = (string?)null,
            role = (string?)null
        });
    }

}

