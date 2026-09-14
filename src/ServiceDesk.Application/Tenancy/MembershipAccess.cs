using ServiceDesk.Domain.Identity;

namespace ServiceDesk.Application.Tenancy;

public sealed record MembershipAccess(
    Guid BusinessId,
    string BusinessName,
    Guid UserId,
    Guid MemberId,
    BusinessRole Role,
    bool IsActive,
    IReadOnlySet<string> Permissions);
