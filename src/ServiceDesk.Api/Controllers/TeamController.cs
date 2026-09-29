using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ServiceDesk.Application.Abstractions;
using ServiceDesk.Application.Security;
using ServiceDesk.Application.Tenancy;

namespace ServiceDesk.Api.Controllers;

[ApiController]
[Route("api/v1/businesses/{businessId:guid}")]
[Authorize(Policy = Permissions.TeamManage)]
public sealed class TeamController(
    ITeamService teamService,
    ITenantContextAccessor tenantContextAccessor) : ControllerBase
{
    [HttpGet("team")]
    public async Task<ActionResult<TeamOverviewResponse>> GetTeamOverview(
        Guid businessId,
        CancellationToken cancellationToken)
    {
        var overview = await teamService.GetTeamOverviewAsync(businessId, cancellationToken);
        return Ok(overview);
    }

    [HttpGet("members")]
    public async Task<ActionResult<IReadOnlyList<TeamMemberResponse>>> GetMembers(
        Guid businessId,
        CancellationToken cancellationToken)
    {
        var members = await teamService.GetMembersAsync(businessId, cancellationToken);
        return Ok(members);
    }

    [HttpGet("invitations")]
    public async Task<ActionResult<IReadOnlyList<InvitationResponse>>> GetInvitations(
        Guid businessId,
        CancellationToken cancellationToken)
    {
        var invitations = await teamService.GetInvitationsAsync(businessId, cancellationToken);
        return Ok(invitations);
    }

    [HttpPost("invitations")]
    public async Task<ActionResult<InvitationResponse>> InviteStaff(
        Guid businessId,
        InviteStaffCommand command,
        CancellationToken cancellationToken)
    {
        try
        {
            var actorMemberId = tenantContextAccessor.Current?.MemberId;
            var actorUserId = tenantContextAccessor.Current?.UserId ?? Guid.Empty;

            var invitation = await teamService.InviteStaffAsync(
                businessId,
                actorMemberId,
                actorUserId,
                command,
                cancellationToken);

            return CreatedAtAction(
                nameof(GetInvitations),
                new { businessId },
                invitation);
        }
        catch (TeamRuleException ex)
        {
            var statusCode = ex.Code switch
            {
                "plan_limit_reached" => StatusCodes.Status409Conflict,
                "invitation_duplicate" => StatusCodes.Status409Conflict,
                "member_not_found" => StatusCodes.Status404NotFound,
                _ => StatusCodes.Status400BadRequest
            };

            return Problem(
                statusCode: statusCode,
                title: "Invitation request failed",
                detail: ex.Message,
                extensions: new Dictionary<string, object?> { ["code"] = ex.Code });
        }
    }

    [HttpPost("invitations/{invitationId:guid}/revoke")]
    public async Task<IActionResult> RevokeInvitation(
        Guid businessId,
        Guid invitationId,
        CancellationToken cancellationToken)
    {
        try
        {
            var actorUserId = tenantContextAccessor.Current?.UserId ?? Guid.Empty;
            await teamService.RevokeInvitationAsync(businessId, invitationId, actorUserId, cancellationToken);
            return NoContent();
        }
        catch (TeamRuleException ex)
        {
            var statusCode = ex.Code switch
            {
                "invitation_not_found" => StatusCodes.Status404NotFound,
                _ => StatusCodes.Status400BadRequest
            };

            return Problem(
                statusCode: statusCode,
                title: "Revoke invitation failed",
                detail: ex.Message,
                extensions: new Dictionary<string, object?> { ["code"] = ex.Code });
        }
    }
}
