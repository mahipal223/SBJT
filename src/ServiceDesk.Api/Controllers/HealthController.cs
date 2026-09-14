using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ServiceDesk.Infrastructure.Data;

namespace ServiceDesk.Api.Controllers;

[ApiController]
[AllowAnonymous]
public sealed class HealthController(IServiceProvider serviceProvider) : ControllerBase
{
    [HttpGet("/health/live")]
    public IActionResult Live() => Ok(new { status = "Healthy" });

    [HttpGet("/health/ready")]
    public async Task<IActionResult> Ready(CancellationToken cancellationToken)
    {
        var baseDAL = serviceProvider.GetService<BaseDAL>();
        var connected = baseDAL is not null && await baseDAL.CanConnectAsync(cancellationToken);
        return connected
            ? Ok(new { status = "Ready", databaseConfigured = true, databaseConnected = true })
            : StatusCode(StatusCodes.Status503ServiceUnavailable,
                new { status = "NotReady", databaseConfigured = baseDAL is not null, databaseConnected = false });
    }
}
