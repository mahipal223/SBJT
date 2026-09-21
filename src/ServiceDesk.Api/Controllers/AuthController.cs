using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ServiceDesk.Application.Abstractions;
using ServiceDesk.Application.Security;

namespace ServiceDesk.Api.Controllers;

/// <summary>
/// Handles user registration, email OTP verification, native login,
/// social identity logins (Google, Apple), and workspace synchronization.
/// </summary>
[ApiController]
[Route("api/v1/auth")]
public sealed class AuthController(
    IAuthenticationService authenticationService,
    IEmailVerificationService emailVerificationService,
    IMembershipResolver membershipResolver) : ControllerBase
{
    [HttpPost("register")]
    [AllowAnonymous]
    public async Task<IActionResult> Register(
        [FromBody] RegisterRequest request,
        CancellationToken cancellationToken)
    {
        try
        {
            var result = await authenticationService.RegisterAsync(request, cancellationToken);
            return Accepted(result);
        }
        catch (AuthRuleException ex)
        {
            return MapAuthException(ex);
        }
    }

    [HttpPost("verify-email-otp")]
    [AllowAnonymous]
    public async Task<IActionResult> VerifyEmailOtp(
        [FromBody] VerifyEmailOtpRequest request,
        CancellationToken cancellationToken)
    {
        try
        {
            var result = await authenticationService.VerifyEmailOtpAndLoginAsync(request, cancellationToken);
            return Ok(result);
        }
        catch (AuthRuleException ex)
        {
            return MapAuthException(ex);
        }
    }

    [HttpPost("resend-email-otp")]
    [AllowAnonymous]
    public async Task<IActionResult> ResendEmailOtp(
        [FromBody] ResendEmailOtpRequest request,
        CancellationToken cancellationToken)
    {
        try
        {
            await emailVerificationService.ResendEmailOtpAsync(request.Email, cancellationToken);
            return Ok(new { message = "Verification code resent successfully." });
        }
        catch (AuthRuleException ex)
        {
            return MapAuthException(ex);
        }
    }

    [HttpPost("login")]
    [AllowAnonymous]
    public async Task<IActionResult> Login(
        [FromBody] LoginRequest request,
        CancellationToken cancellationToken)
    {
        try
        {
            var result = await authenticationService.LoginAsync(request, cancellationToken);
            return Ok(result);
        }
        catch (AuthRuleException ex)
        {
            return MapAuthException(ex);
        }
    }

    [HttpPost("google")]
    [AllowAnonymous]
    public async Task<IActionResult> GoogleLogin(
        [FromBody] GoogleLoginRequest request,
        CancellationToken cancellationToken)
    {
        try
        {
            var result = await authenticationService.GoogleLoginAsync(request, cancellationToken);
            return Ok(result);
        }
        catch (AuthRuleException ex)
        {
            return MapAuthException(ex);
        }
    }

    [HttpPost("apple")]
    [AllowAnonymous]
    public async Task<IActionResult> AppleLogin(
        [FromBody] AppleLoginRequest request,
        CancellationToken cancellationToken)
    {
        try
        {
            var result = await authenticationService.AppleLoginAsync(request, cancellationToken);
            return Ok(result);
        }
        catch (AuthRuleException ex)
        {
            return MapAuthException(ex);
        }
    }

    /// <summary>
    /// Synchronizes the authenticated user with their workspace membership.
    /// </summary>
    [HttpPost("sync-user")]
    [Authorize]
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

        var userId = UserIdentityUtilities.DeriveUserId(subject);

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

    private ObjectResult MapAuthException(AuthRuleException ex)
    {
        var statusCode = ex.Code switch
        {
            "email_in_use" => 409,
            "account_locked" => 423,
            "invalid_credentials" => 401,
            "email_not_verified" => 403,
            "rate_limited" => 429,
            "too_many_attempts" => 429,
            "resource_not_found" => 404,
            _ => 400
        };

        return Problem(
            statusCode: statusCode,
            title: "Authentication error",
            detail: ex.Message,
            extensions: new Dictionary<string, object?> { ["code"] = ex.Code });
    }
}
