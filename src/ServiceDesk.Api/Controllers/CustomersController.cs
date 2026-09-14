using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ServiceDesk.Application.Security;
using ServiceDesk.Application.Work;

namespace ServiceDesk.Api.Controllers;

[ApiController]
[Route("api/v1/businesses/{businessId:guid}/customers")]
public sealed class CustomersController(IWorkStore store) : ControllerBase
{
    [HttpGet]
    [Authorize(Policy = Permissions.CustomersRead)]
    public async Task<ActionResult<PageResult<CustomerRecord>>> List(Guid businessId, [FromQuery] string? search, [FromQuery] bool includeArchived = false, [FromQuery] int page = 1, [FromQuery] int pageSize = 25, CancellationToken cancellationToken = default)
        => Ok(await store.ListCustomersAsync(businessId, search, includeArchived, page, pageSize, cancellationToken));

    [HttpGet("{customerId:guid}")]
    [Authorize(Policy = Permissions.CustomersRead)]
    public async Task<ActionResult<CustomerRecord>> Get(Guid businessId, Guid customerId, CancellationToken cancellationToken)
        => await store.GetCustomerAsync(businessId, customerId, cancellationToken) is { } customer ? Ok(customer) : NotFound(Problem("resource_not_found", "The requested resource was not found."));

    [HttpPost]
    [Authorize(Policy = Permissions.CustomersWrite)]
    public async Task<ActionResult<CustomerRecord>> Create(Guid businessId, CreateCustomerCommand command, CancellationToken cancellationToken)
    {
        try
        {
            var customer = await store.CreateCustomerAsync(businessId, command, cancellationToken);
            return CreatedAtAction(nameof(Get), new { businessId, customerId = customer.Id }, customer);
        }
        catch (WorkRuleException ex) { return BadRequest(Problem(ex.Code, ex.Message)); }
    }

    private object Problem(string code, string detail) => new { type = $"https://api.servicedesk.example/problems/{code}", title = "Request failed", status = 400, detail, code, traceId = HttpContext.TraceIdentifier };
}
