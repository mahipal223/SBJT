using System.ComponentModel.DataAnnotations;

namespace ServiceDesk.Application.Tenancy;

public sealed record TeamMemberResponse(
    Guid Id,
    Guid UserId,
    string FullName,
    string Email,
    string Role,
    string Status,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt,
    string Version);

public sealed record InvitationResponse(
    Guid Id,
    string Email,
    string Role,
    string Status,
    DateTimeOffset ExpiresAt,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt,
    string Version);

public sealed record InviteStaffCommand
{
    [Required, EmailAddress, StringLength(254)]
    public string Email { get; init; } = string.Empty;

    [Required, RegularExpression("^(Manager|Technician)$", ErrorMessage = "Role must be Manager or Technician.")]
    public string Role { get; init; } = "Technician";
}

public sealed record TeamOverviewResponse(
    IReadOnlyList<TeamMemberResponse> Members,
    IReadOnlyList<InvitationResponse> Invitations,
    int ActiveMemberCount,
    int PendingInvitationCount,
    int? PlanSeatLimit);

public class TeamRuleException(string code, string message) : Exception(message)
{
    public string Code { get; } = code;
}

public interface ITeamService
{
    Task<IReadOnlyList<TeamMemberResponse>> GetMembersAsync(
        Guid businessId,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<InvitationResponse>> GetInvitationsAsync(
        Guid businessId,
        CancellationToken cancellationToken = default);

    Task<TeamOverviewResponse> GetTeamOverviewAsync(
        Guid businessId,
        CancellationToken cancellationToken = default);

    Task<InvitationResponse> InviteStaffAsync(
        Guid businessId,
        Guid? actorMemberId,
        Guid actorUserId,
        InviteStaffCommand command,
        CancellationToken cancellationToken = default);

    Task RevokeInvitationAsync(
        Guid businessId,
        Guid invitationId,
        Guid actorUserId,
        CancellationToken cancellationToken = default);
}
