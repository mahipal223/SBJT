using System.Security.Claims;
using Microsoft.AspNetCore.Authentication;
using ServiceDesk.Application.Abstractions;
using ServiceDesk.Application.Security;
using ServiceDesk.Infrastructure.Tenancy;

namespace ServiceDesk.Api.Middleware;

public sealed class TenantResolutionMiddleware(RequestDelegate next)
{
    public async Task InvokeAsync(
        HttpContext httpContext,
        IMembershipResolver membershipResolver,
        TenantContextAccessor tenantContextAccessor)
    {
        if (!httpContext.Request.RouteValues.TryGetValue("businessId", out var value))
        {
            await next(httpContext);
            return;
        }

        if (!Guid.TryParse(value?.ToString(), out var businessId))
        {
            await WriteProblemAsync(httpContext, 400, "invalid_business_id", "The business ID is invalid.");
            return;
        }

        var subject = httpContext.User.FindFirstValue(ClaimTypes.NameIdentifier)
                      ?? httpContext.User.FindFirstValue("sub");

        if (string.IsNullOrWhiteSpace(subject))
        {
            await httpContext.ChallengeAsync();
            return;
        }

        Guid userId;
        try
        {
            userId = UserIdentityUtilities.DeriveUserId(subject);
        }
        catch
        {
            await httpContext.ChallengeAsync();
            return;
        }

        var membership = await membershipResolver.ResolveAsync(
            userId,
            businessId,
            httpContext.RequestAborted);

        if (membership is null || !membership.IsActive)
        {
            await WriteProblemAsync(httpContext, 404, "resource_not_found", "The requested resource was not found.");
            return;
        }

        tenantContextAccessor.Set(new TenantContext(
            membership.BusinessId,
            membership.UserId,
            membership.MemberId,
            membership.Role,
            membership.Permissions));

        try
        {
            await next(httpContext);
        }
        finally
        {
            tenantContextAccessor.Clear();
        }
    }

    private static Task WriteProblemAsync(
        HttpContext context,
        int status,
        string code,
        string detail)
    {
        context.Response.StatusCode = status;
        return context.Response.WriteAsJsonAsync(new
        {
            type = $"https://api.servicedesk.example/problems/{code}",
            title = status == 404 ? "Resource not found" : "Invalid request",
            status,
            detail,
            code,
            traceId = context.TraceIdentifier
        });
    }
}
