using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ServiceDesk.Application.Security;
using ServiceDesk.Application.Work;

namespace ServiceDesk.Api.Controllers;

[ApiController]
[Route("api/v1/businesses/{businessId:guid}/jobs")]
public sealed class JobsController(IWorkStore store, IConfiguration configuration) : ControllerBase
{
    [HttpGet]
    [Authorize(Policy = Permissions.JobsRead)]
    public async Task<ActionResult<PageResult<JobRecord>>> List(Guid businessId, [FromQuery] string? search, [FromQuery] string? status, [FromQuery] int page = 1, [FromQuery] int pageSize = 25, CancellationToken cancellationToken = default)
        => Ok(await store.ListJobsAsync(businessId, search, status, page, pageSize, cancellationToken));

    [HttpGet("{jobId:guid}")]
    [Authorize(Policy = Permissions.JobsRead)]
    public async Task<ActionResult<JobRecord>> Get(Guid businessId, Guid jobId, CancellationToken cancellationToken)
        => await store.GetJobAsync(businessId, jobId, cancellationToken) is { } job ? Ok(job) : NotFound(Problem("resource_not_found", "The requested resource was not found.", 404));

    [HttpPost]
    [Authorize(Policy = Permissions.JobsWrite)]
    public async Task<ActionResult<JobRecord>> Create(Guid businessId, CreateJobCommand command, CancellationToken cancellationToken)
    {
        try
        {
            var limit = configuration.GetValue("DemoPlans:JobsPerPeriod", 100);
            var job = await store.CreateJobAsync(businessId, command, limit, cancellationToken);
            return CreatedAtAction(nameof(Get), new { businessId, jobId = job.Id }, job);
        }
        catch (WorkRuleException ex) when (ex.Code == "plan_limit_reached") { return Conflict(Problem(ex.Code, ex.Message, 409)); }
        catch (WorkRuleException ex) { return BadRequest(Problem(ex.Code, ex.Message, 400)); }
    }

    [HttpGet("{jobId:guid}/items")]
    [Authorize(Policy = Permissions.JobsRead)]
    public async Task<ActionResult<JobItemSet>> GetItems(Guid businessId, Guid jobId, CancellationToken cancellationToken)
    {
        try { return Ok(await store.GetJobItemsAsync(businessId, jobId, cancellationToken)); }
        catch (WorkRuleException ex) { return NotFound(Problem(ex.Code, ex.Message, 404)); }
    }

    [HttpPost("{jobId:guid}/status")]
    [Authorize(Policy = Permissions.JobsWrite)]
    public async Task<ActionResult<JobRecord>> ChangeStatus(
        Guid businessId,
        Guid jobId,
        ChangeJobStatusCommand command,
        CancellationToken cancellationToken)
    {
        try
        {
            return Ok(await store.ChangeJobStatusAsync(businessId, jobId, command, cancellationToken));
        }
        catch (WorkRuleException ex) when (ex.Code == "resource_not_found")
        {
            return NotFound(Problem(ex.Code, ex.Message, 404));
        }
        catch (WorkRuleException ex) when (ex.Code == "invalid_transition")
        {
            return UnprocessableEntity(Problem(ex.Code, ex.Message, 422));
        }
        catch (WorkRuleException ex)
        {
            return BadRequest(Problem(ex.Code, ex.Message, 400));
        }
    }

    [HttpPut("{jobId:guid}/items")]
    [Authorize(Policy = Permissions.JobsWrite)]
    public async Task<ActionResult<JobItemSet>> ReplaceItems(Guid businessId, Guid jobId, IReadOnlyList<ReplaceJobItemCommand> commands, CancellationToken cancellationToken)
    {
        try { return Ok(await store.ReplaceJobItemsAsync(businessId, jobId, commands, cancellationToken)); }
        catch (WorkRuleException ex) when (ex.Code == "resource_not_found") { return NotFound(Problem(ex.Code, ex.Message, 404)); }
        catch (WorkRuleException ex) when (ex.Code == "job_locked") { return Conflict(Problem(ex.Code, ex.Message, 409)); }
        catch (WorkRuleException ex) { return BadRequest(Problem(ex.Code, ex.Message, 400)); }
    }

    private object Problem(string code, string detail, int status) => new { type = $"https://api.servicedesk.example/problems/{code}", title = "Request failed", status, detail, code, traceId = HttpContext.TraceIdentifier };
}
