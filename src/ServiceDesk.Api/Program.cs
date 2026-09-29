using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.RateLimiting;
using ServiceDesk.Api.Authentication;
using ServiceDesk.Api.Extensions;
using ServiceDesk.Api.Middleware;
using ServiceDesk.Api.Security;
using ServiceDesk.Api.Tenancy;
using ServiceDesk.Application.Abstractions;
using ServiceDesk.Application.Security;
using ServiceDesk.Application.Work;
using ServiceDesk.Infrastructure.Tenancy;

var builder = WebApplication.CreateBuilder(args);

builder.WebHost.ConfigureKestrel(serverOptions =>
{
    serverOptions.AddServerHeader = false;
    serverOptions.Limits.MaxRequestBodySize = 10 * 1024 * 1024;
});

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

builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.AddPolicy("AuthPolicy", httpContext =>
    {
        var ip = httpContext.Connection.RemoteIpAddress?.ToString()
            ?? httpContext.Request.Headers["X-Forwarded-For"].FirstOrDefault()
            ?? "anonymous";

        return RateLimitPartition.GetFixedWindowLimiter(
            ip,
            _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 10,
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 0
            });
    });
});

// ─── Authentication ───────────────────────────────────────────────────────────
// Primary scheme: Native ServiceDesk JWT Bearer (Email/Password, Google, Apple).
// Fallback: Development mock handler (only active in Development environment).
// ─────────────────────────────────────────────────────────────────────────────

var jwtSecretKey = builder.Configuration["Jwt:SecretKey"]
    ?? "ServiceDeskSuperSecretSigningKeyForDevelopmentPurposesOnly_MustBeAtLeast32BytesLong!";

if (!builder.Environment.IsDevelopment() &&
    (string.IsNullOrWhiteSpace(builder.Configuration["Jwt:SecretKey"]) ||
     jwtSecretKey.Contains("DevelopmentPurposesOnly", StringComparison.OrdinalIgnoreCase)))
{
    throw new InvalidOperationException("FATAL: A secure, non-default Jwt:SecretKey configuration is required in Production.");
}

var jwtIssuer = builder.Configuration["Jwt:Issuer"] ?? "ServiceDesk.Api";
var jwtAudience = builder.Configuration["Jwt:Audience"] ?? "ServiceDesk.Client";
var signingKey = new Microsoft.IdentityModel.Tokens.SymmetricSecurityKey(System.Text.Encoding.UTF8.GetBytes(jwtSecretKey));

const string smartAuthScheme = "SmartAuth";

var authBuilder = builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = smartAuthScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
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

        return JwtBearerDefaults.AuthenticationScheme;
    };
});

authBuilder.AddJwtBearer(options =>
{
    options.TokenValidationParameters = new Microsoft.IdentityModel.Tokens.TokenValidationParameters
    {
        ValidateIssuerSigningKey = true,
        IssuerSigningKey = signingKey,
        ValidateIssuer = true,
        ValidIssuer = jwtIssuer,
        ValidateAudience = true,
        ValidAudience = jwtAudience,
        ValidateLifetime = true,
        ClockSkew = TimeSpan.FromMinutes(5),
        NameClaimType = "sub"
    };
});

// Keep dev handler registered so local development without tokens still works.
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

app.UseForwardedHeaders(new ForwardedHeadersOptions
{
    ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto
});

if (!app.Environment.IsDevelopment())
{
    app.UseHsts();
    app.UseHttpsRedirection();
}

app.Use(async (context, next) =>
{
    context.Response.Headers.Append("X-Content-Type-Options", "nosniff");
    context.Response.Headers.Append("X-Frame-Options", "DENY");
    context.Response.Headers.Append("Referrer-Policy", "strict-origin-when-cross-origin");
    context.Response.Headers.Append("X-XSS-Protection", "1; mode=block");
    context.Response.Headers.Append("Content-Security-Policy", "default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https:; frame-ancestors 'none';");
    context.Response.Headers.Append("Permissions-Policy", "accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()");
    await next();
});

app.UseExceptionHandler();
app.UseCors("Angular");
app.UseRateLimiter();
app.UseRouting();
app.UseAuthentication();
app.UseMiddleware<PlatformContextMiddleware>();
app.UseMiddleware<TenantResolutionMiddleware>();
app.UseAuthorization();
app.MapControllers();

app.Run();

public partial class Program;
