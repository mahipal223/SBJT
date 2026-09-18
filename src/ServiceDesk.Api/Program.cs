using Microsoft.AspNetCore.Authentication.JwtBearer;
using ServiceDesk.Api.Authentication;
using ServiceDesk.Api.Extensions;
using ServiceDesk.Api.Middleware;
using ServiceDesk.Api.Security;
using ServiceDesk.Api.Tenancy;
using ServiceDesk.Application.Abstractions;
using ServiceDesk.Application.Security;
using ServiceDesk.Infrastructure.Tenancy;
using ServiceDesk.Application.Work;

var builder = WebApplication.CreateBuilder(args);

builder.Logging.ClearProviders();
builder.Logging.AddConsole();

builder.Services.AddProblemDetails();
builder.Services.AddControllers();
builder.Services.AddServiceDeskServices(builder.Configuration);
builder.Services.AddCors(options =>
{
    options.AddPolicy("Angular", policy => policy
        .WithOrigins(builder.Configuration.GetSection("Cors:Origins").Get<string[]>() ?? [])
        .AllowAnyHeader()
        .AllowAnyMethod()
        .WithExposedHeaders("Content-Disposition"));
});

// ─── Authentication ───────────────────────────────────────────────────────────
// Primary scheme: Auth0 JWT Bearer (email/password + Google).
// Fallback: Development mock handler (only active in Development environment).
// Once Auth0 is configured, Bearer tokens are validated against the Auth0 tenant.
// ─────────────────────────────────────────────────────────────────────────────

var auth0Authority = builder.Configuration["Auth0:Authority"];
var auth0Audience = builder.Configuration["Auth0:Audience"];
var hasAuth0Config = !string.IsNullOrWhiteSpace(auth0Authority)
                     && !auth0Authority.Contains("FILL_IN");

const string smartAuthScheme = "SmartAuth";

var authBuilder = builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = smartAuthScheme;
    options.DefaultChallengeScheme = hasAuth0Config
        ? JwtBearerDefaults.AuthenticationScheme
        : DevelopmentAuthenticationDefaults.Scheme;
});

authBuilder.AddPolicyScheme(smartAuthScheme, "Bearer or Dev Header", options =>
{
    options.ForwardDefaultSelector = context =>
    {
        var authHeader = context.Request.Headers.Authorization.ToString();
        if (!string.IsNullOrEmpty(authHeader) && authHeader.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
        {
            return JwtBearerDefaults.AuthenticationScheme;
        }

        if (builder.Environment.IsDevelopment() &&
            (context.Request.Headers.ContainsKey(DevelopmentAuthenticationDefaults.UserHeader) ||
             context.Request.Headers.ContainsKey(DevelopmentAuthenticationDefaults.PlatformAdminHeader)))
        {
            return DevelopmentAuthenticationDefaults.Scheme;
        }

        return hasAuth0Config
            ? JwtBearerDefaults.AuthenticationScheme
            : DevelopmentAuthenticationDefaults.Scheme;
    };
});

if (hasAuth0Config)
{
    authBuilder.AddJwtBearer(options =>
    {
        options.Authority = auth0Authority;
        options.Audience = auth0Audience;
        // Auth0 uses "sub" as the unique user identifier claim.
        options.TokenValidationParameters = new Microsoft.IdentityModel.Tokens.TokenValidationParameters
        {
            NameClaimType = "sub"
        };
    });
}

// Keep dev handler registered so local development without Auth0 still works.
if (builder.Environment.IsDevelopment())
{
    authBuilder.AddScheme<Microsoft.AspNetCore.Authentication.AuthenticationSchemeOptions, DevelopmentAuthenticationHandler>(
        DevelopmentAuthenticationDefaults.Scheme,
        _ => { });
}

builder.Services.AddAuthorization(options =>
{
    foreach (var permission in Permissions.All)
    {
        options.AddPolicy(permission, policy =>
            policy.RequireAuthenticatedUser()
                .AddRequirements(new PermissionRequirement(permission)));
    }
});

builder.Services.AddScoped<TenantContextAccessor>();
builder.Services.AddScoped<ITenantContextAccessor>(services =>
    services.GetRequiredService<TenantContextAccessor>());
builder.Services.AddScoped<PlatformContextAccessor>();
builder.Services.AddScoped<ServiceDesk.Application.Platform.IPlatformContextAccessor>(services =>
    services.GetRequiredService<PlatformContextAccessor>());
builder.Services.AddScoped<IMembershipResolver, ServiceDesk.Infrastructure.Tenancy.DbMembershipResolver>();
builder.Services.AddScoped<Microsoft.AspNetCore.Authorization.IAuthorizationHandler, PermissionAuthorizationHandler>();

var app = builder.Build();

app.UseExceptionHandler();
app.UseCors("Angular");
app.UseRouting();
app.UseAuthentication();
app.UseMiddleware<PlatformContextMiddleware>();
app.UseMiddleware<TenantResolutionMiddleware>();
app.UseAuthorization();
app.MapControllers();

app.Run();

public partial class Program;
