using System.Security.Claims;
using ServiceDesk.Api.Security;
using ServiceDesk.Application.Platform;

namespace ServiceDesk.Api.Middleware;

public sealed class PlatformContextMiddleware(RequestDelegate next)
{
    public async Task InvokeAsync(
        HttpContext httpContext,
        IAdministratorResolver administratorResolver,
        PlatformContextAccessor platformContextAccessor)
    {
        var endpoint = httpContext.GetEndpoint();
        var isPlatformEndpoint = endpoint?.Metadata.GetMetadata<PlatformEndpointAttribute>() is not null
                                 || httpContext.Request.Path.StartsWithSegments("/api/v1/admin");

        if (!isPlatformEndpoint)
        {
            await next(httpContext);
            return;
        }

        var subject = httpContext.User.FindFirstValue(ClaimTypes.NameIdentifier)
                      ?? httpContext.User.FindFirstValue("sub");

        if (!string.IsNullOrWhiteSpace(subject) && Guid.TryParse(subject, out var adminUserId))
        {
            var admin = await administratorResolver.ResolveAsync(adminUserId, httpContext.RequestAborted);
            if (admin is not null && admin.IsActive)
            {
                platformContextAccessor.Set(PlatformContext.Create(admin));
            }
        }

        try
        {
            await next(httpContext);
        }
        finally
        {
            platformContextAccessor.Clear();
        }
    }
}
