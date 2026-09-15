using System.Security.Claims;
using System.Text.Encodings.Web;
using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.Options;
using ServiceDesk.Application.Platform;

namespace ServiceDesk.Api.Authentication;

public sealed class DevelopmentAuthenticationHandler(
    IOptionsMonitor<AuthenticationSchemeOptions> options,
    ILoggerFactory logger,
    UrlEncoder encoder,
    IHostEnvironment environment,
    IConfiguration configuration,
    IAdministratorResolver administratorResolver)
    : AuthenticationHandler<AuthenticationSchemeOptions>(options, logger, encoder)
{
    protected override async Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        if (!environment.IsDevelopment())
        {
            return AuthenticateResult.NoResult();
        }

        var hasUserHeader = Request.Headers.TryGetValue(DevelopmentAuthenticationDefaults.UserHeader, out var userHeader);
        var hasAdminHeader = Request.Headers.TryGetValue(DevelopmentAuthenticationDefaults.PlatformAdminHeader, out var adminHeader);

        if (hasUserHeader && hasAdminHeader)
        {
            return AuthenticateResult.Fail("Conflicting identity headers provided: cannot supply both tenant and platform identity.");
        }

        if (hasAdminHeader)
        {
            var isPlatformDevAuthEnabled = configuration.GetValue<bool>("PlatformAdmin:EnableDevAuthentication");
            if (!isPlatformDevAuthEnabled)
            {
                return AuthenticateResult.Fail("Platform development authentication is disabled.");
            }

            if (!Guid.TryParse(adminHeader.ToString(), out var adminUserId))
            {
                return AuthenticateResult.Fail("Invalid platform administrator header.");
            }

            var admin = await administratorResolver.ResolveAsync(adminUserId, Context.RequestAborted).ConfigureAwait(false);
            if (admin is null || !admin.IsActive)
            {
                return AuthenticateResult.Fail("Platform administrator record not found or inactive.");
            }

            var claims = new List<Claim>
            {
                new(ClaimTypes.NameIdentifier, admin.UserId.ToString()),
                new("sub", admin.UserId.ToString()),
                new(ClaimTypes.Name, admin.FullName),
                new(ClaimTypes.Email, admin.Email),
                new(ClaimTypes.Role, admin.RoleCode),
                new("platform_role", admin.RoleCode)
            };

            foreach (var permission in PlatformContext.GetPermissionsForRole(admin.RoleCode))
            {
                claims.Add(new Claim("platform_permission", permission));
            }

            var identity = new ClaimsIdentity(claims, Scheme.Name);
            var principal = new ClaimsPrincipal(identity);
            return AuthenticateResult.Success(new AuthenticationTicket(principal, Scheme.Name));
        }

        if (hasUserHeader)
        {
            if (!Guid.TryParse(userHeader.ToString(), out var userId))
            {
                return AuthenticateResult.NoResult();
            }

            var claims = new[]
            {
                new Claim(ClaimTypes.NameIdentifier, userId.ToString()),
                new Claim("sub", userId.ToString()),
                new Claim(ClaimTypes.Name, $"Development user {userId}")
            };

            var identity = new ClaimsIdentity(claims, Scheme.Name);
            var principal = new ClaimsPrincipal(identity);
            return AuthenticateResult.Success(new AuthenticationTicket(principal, Scheme.Name));
        }

        return AuthenticateResult.NoResult();
    }
}
