using System.Data;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.Data.SqlClient;
using ServiceDesk.Application.DataControls;
using ServiceDesk.Application.Tenancy;
using ServiceDesk.Infrastructure.Data;

namespace ServiceDesk.Infrastructure.Services;

public sealed class TeamService(BaseDAL baseDAL, IAuditService auditService) : ITeamService
{
    public async Task<IReadOnlyList<TeamMemberResponse>> GetMembersAsync(
        Guid businessId,
        CancellationToken cancellationToken = default)
    {
        const string sql = """
            SELECT
                m.Id,
                m.UserId,
                u.FullName,
                u.Email,
                m.RoleCode,
                m.Status,
                m.CreatedAt,
                m.UpdatedAt,
                CONVERT(varchar(30), m.Version, 1) AS Version
            FROM app.Members AS m
            INNER JOIN auth.Users AS u ON u.Id = m.UserId
            WHERE m.BusinessId = @BusinessId
            ORDER BY
                CASE WHEN m.RoleCode = 'Owner' THEN 0 WHEN m.RoleCode = 'Manager' THEN 1 ELSE 2 END,
                m.CreatedAt;
            """;

        return await baseDAL.ExecuteQueryAsync(
            businessId,
            "Team.Members.List",
            sql,
            reader => new TeamMemberResponse(
                reader.GetGuid(0),
                reader.GetGuid(1),
                reader.GetString(2),
                reader.GetString(3),
                reader.GetString(4),
                reader.GetString(5),
                new DateTimeOffset(DateTime.SpecifyKind(reader.GetDateTime(6), DateTimeKind.Utc)),
                new DateTimeOffset(DateTime.SpecifyKind(reader.GetDateTime(7), DateTimeKind.Utc)),
                reader.GetString(8)),
            [UniqueIdentifier("@BusinessId", businessId)],
            cancellationToken).ConfigureAwait(false);
    }

    public async Task<IReadOnlyList<InvitationResponse>> GetInvitationsAsync(
        Guid businessId,
        CancellationToken cancellationToken = default)
    {
        const string sql = """
            SELECT
                i.Id,
                i.Email,
                i.RoleCode,
                i.Status,
                i.ExpiresAt,
                i.CreatedAt,
                i.UpdatedAt,
                CONVERT(varchar(30), i.Version, 1) AS Version
            FROM app.Invitations AS i
            WHERE i.BusinessId = @BusinessId
            ORDER BY i.CreatedAt DESC;
            """;

        return await baseDAL.ExecuteQueryAsync(
            businessId,
            "Team.Invitations.List",
            sql,
            reader => new InvitationResponse(
                reader.GetGuid(0),
                reader.GetString(1),
                reader.GetString(2),
                reader.GetString(3),
                new DateTimeOffset(DateTime.SpecifyKind(reader.GetDateTime(4), DateTimeKind.Utc)),
                new DateTimeOffset(DateTime.SpecifyKind(reader.GetDateTime(5), DateTimeKind.Utc)),
                new DateTimeOffset(DateTime.SpecifyKind(reader.GetDateTime(6), DateTimeKind.Utc)),
                reader.GetString(7)),
            [UniqueIdentifier("@BusinessId", businessId)],
            cancellationToken).ConfigureAwait(false);
    }

    public async Task<TeamOverviewResponse> GetTeamOverviewAsync(
        Guid businessId,
        CancellationToken cancellationToken = default)
    {
        var members = await GetMembersAsync(businessId, cancellationToken).ConfigureAwait(false);
        var invitations = await GetInvitationsAsync(businessId, cancellationToken).ConfigureAwait(false);

        const string limitSql = """
            SELECT pe.LimitValue
            FROM app.Subscriptions s
            INNER JOIN platform.Plans p ON p.Id = s.PlanId
            INNER JOIN platform.PlanEntitlements pe ON pe.PlanId = p.Id AND pe.FeatureCode = 'staff.seats'
            WHERE s.BusinessId = @BusinessId AND s.Status = 'Active';
            """;

        var seatLimit = await baseDAL.ExecuteScalarAsync<long?>(
            businessId,
            "Team.SeatLimit",
            limitSql,
            [UniqueIdentifier("@BusinessId", businessId)],
            cancellationToken).ConfigureAwait(false);

        var activeMembers = members.Count(m => m.Status.Equals("Active", StringComparison.OrdinalIgnoreCase));
        var pendingInvites = invitations.Count(i => i.Status.Equals("Pending", StringComparison.OrdinalIgnoreCase) && i.ExpiresAt > DateTimeOffset.UtcNow);

        return new TeamOverviewResponse(
            members,
            invitations,
            activeMembers,
            pendingInvites,
            seatLimit.HasValue ? (int)seatLimit.Value : null);
    }

    public async Task<InvitationResponse> InviteStaffAsync(
        Guid businessId,
        Guid? actorMemberId,
        Guid actorUserId,
        InviteStaffCommand command,
        CancellationToken cancellationToken = default)
    {
        var trimmedEmail = command.Email.Trim();
        var normalizedEmail = trimmedEmail.ToUpperInvariant();

        // 1. Resolve invitedByMemberId if not supplied
        Guid resolvedMemberId;
        if (actorMemberId.HasValue && actorMemberId.Value != Guid.Empty)
        {
            resolvedMemberId = actorMemberId.Value;
        }
        else
        {
            const string resolveMemberSql = """
                SELECT TOP (1) Id FROM app.Members WHERE BusinessId = @BusinessId AND UserId = @UserId;
                """;
            var id = await baseDAL.ExecuteScalarAsync<Guid?>(
                businessId,
                "Team.ResolveMemberId",
                resolveMemberSql,
                [
                    UniqueIdentifier("@BusinessId", businessId),
                    UniqueIdentifier("@UserId", actorUserId)
                ],
                cancellationToken).ConfigureAwait(false);

            if (!id.HasValue)
            {
                // Fallback to first active owner/manager in business
                const string fallbackMemberSql = """
                    SELECT TOP (1) Id FROM app.Members WHERE BusinessId = @BusinessId AND Status = 'Active' ORDER BY CreatedAt;
                    """;
                id = await baseDAL.ExecuteScalarAsync<Guid?>(
                    businessId,
                    "Team.FallbackMemberId",
                    fallbackMemberSql,
                    [UniqueIdentifier("@BusinessId", businessId)],
                    cancellationToken).ConfigureAwait(false);
            }

            resolvedMemberId = id ?? throw new TeamRuleException("member_not_found", "Valid member context required to send an invitation.");
        }

        // 2. Check seat limits
        const string checkSeatsSql = """
            SELECT
                (SELECT pe.LimitValue
                 FROM app.Subscriptions s
                 INNER JOIN platform.Plans p ON p.Id = s.PlanId
                 INNER JOIN platform.PlanEntitlements pe ON pe.PlanId = p.Id AND pe.FeatureCode = 'staff.seats'
                 WHERE s.BusinessId = @BusinessId AND s.Status = 'Active') AS SeatLimit,
                (SELECT COUNT(1) FROM app.Members WHERE BusinessId = @BusinessId AND Status = 'Active') AS ActiveCount,
                (SELECT COUNT(1) FROM app.Invitations WHERE BusinessId = @BusinessId AND Status = 'Pending' AND ExpiresAt > SYSUTCDATETIME()) AS PendingCount;
            """;

        var seatsData = await baseDAL.ExecuteSingleAsync(
            businessId,
            "Team.CheckSeatCapacity",
            checkSeatsSql,
            reader => new SeatCapacityInfo(
                reader.IsDBNull(0) ? null : reader.GetInt64(0),
                reader.GetInt32(1),
                reader.GetInt32(2)),
            [UniqueIdentifier("@BusinessId", businessId)],
            cancellationToken).ConfigureAwait(false);

        if (seatsData?.SeatLimit is not null)
        {
            var allocated = seatsData.ActiveCount + seatsData.PendingCount;
            if (allocated >= seatsData.SeatLimit.Value)
            {
                throw new TeamRuleException(
                    "plan_limit_reached",
                    $"Plan seat limit reached ({allocated} of {seatsData.SeatLimit.Value} used). Upgrade your subscription to invite additional staff.");
            }
        }

        // 3. Duplicate checks
        const string checkDupSql = """
            SELECT
                (SELECT COUNT(1) FROM app.Members m INNER JOIN auth.Users u ON u.Id = m.UserId WHERE m.BusinessId = @BusinessId AND m.Status = 'Active' AND u.NormalizedEmail = @NormalizedEmail) AS MemberExists,
                (SELECT COUNT(1) FROM app.Invitations WHERE BusinessId = @BusinessId AND NormalizedEmail = @NormalizedEmail AND Status = 'Pending' AND ExpiresAt > SYSUTCDATETIME()) AS InviteExists;
            """;

        var dupData = await baseDAL.ExecuteSingleAsync(
            businessId,
            "Team.CheckDuplicateEmail",
            checkDupSql,
            reader => new DuplicateCheckInfo(reader.GetInt32(0) > 0, reader.GetInt32(1) > 0),
            [
                UniqueIdentifier("@BusinessId", businessId),
                NVarChar("@NormalizedEmail", normalizedEmail, 254)
            ],
            cancellationToken).ConfigureAwait(false);

        if (dupData?.MemberExists == true)
        {
            throw new TeamRuleException("invitation_duplicate", "A team member with this email address already exists in your workspace.");
        }
        if (dupData?.InviteExists == true)
        {
            throw new TeamRuleException("invitation_duplicate", "A pending invitation has already been sent to this email address.");
        }

        // 4. Create Invitation
        var invitationId = Guid.NewGuid();
        var rawToken = Convert.ToHexString(RandomNumberGenerator.GetBytes(32)).ToLowerInvariant();
        var tokenHash = SHA256.HashData(Encoding.UTF8.GetBytes(rawToken));
        var expiresAt = DateTimeOffset.UtcNow.AddDays(7);

        const string insertSql = """
            INSERT INTO app.Invitations
                (BusinessId, Id, Email, NormalizedEmail, RoleCode, TokenHash, Status, InvitedByMemberId, ExpiresAt, CreatedAt, UpdatedAt)
            OUTPUT
                inserted.Id,
                inserted.Email,
                inserted.RoleCode,
                inserted.Status,
                inserted.ExpiresAt,
                inserted.CreatedAt,
                inserted.UpdatedAt,
                CONVERT(varchar(30), inserted.Version, 1) AS Version
            VALUES
                (@BusinessId, @Id, @Email, @NormalizedEmail, @RoleCode, @TokenHash, 'Pending', @InvitedByMemberId, @ExpiresAt, SYSUTCDATETIME(), SYSUTCDATETIME());
            """;

        var created = await baseDAL.ExecuteSingleAsync(
            businessId,
            "Team.Invitations.Create",
            insertSql,
            reader => new InvitationResponse(
                reader.GetGuid(0),
                reader.GetString(1),
                reader.GetString(2),
                reader.GetString(3),
                new DateTimeOffset(DateTime.SpecifyKind(reader.GetDateTime(4), DateTimeKind.Utc)),
                new DateTimeOffset(DateTime.SpecifyKind(reader.GetDateTime(5), DateTimeKind.Utc)),
                new DateTimeOffset(DateTime.SpecifyKind(reader.GetDateTime(6), DateTimeKind.Utc)),
                reader.GetString(7)),
            [
                UniqueIdentifier("@BusinessId", businessId),
                UniqueIdentifier("@Id", invitationId),
                NVarChar("@Email", trimmedEmail, 254),
                NVarChar("@NormalizedEmail", normalizedEmail, 254),
                NVarChar("@RoleCode", command.Role, 32),
                Binary("@TokenHash", tokenHash, 32),
                UniqueIdentifier("@InvitedByMemberId", resolvedMemberId),
                DateTime2("@ExpiresAt", expiresAt.UtcDateTime)
            ],
            cancellationToken).ConfigureAwait(false) ?? throw new TeamRuleException("invitation_failed", "Failed to create invitation record.");

        // 5. Record Audit Event
        await auditService.RecordAuditEventAsync(
            businessId,
            actorUserId,
            "team.member_invited",
            "Invitation",
            invitationId,
            JsonSerializer.Serialize(new { email = trimmedEmail, role = command.Role }),
            cancellationToken).ConfigureAwait(false);

        return created;
    }

    public async Task RevokeInvitationAsync(
        Guid businessId,
        Guid invitationId,
        Guid actorUserId,
        CancellationToken cancellationToken = default)
    {
        const string revokeSql = """
            UPDATE app.Invitations
            SET Status = 'Revoked',
                UpdatedAt = SYSUTCDATETIME()
            WHERE BusinessId = @BusinessId
              AND Id = @InvitationId
              AND Status = 'Pending';
            """;

        var affected = await baseDAL.ExecuteNonQueryAsync(
            businessId,
            "Team.Invitations.Revoke",
            revokeSql,
            [
                UniqueIdentifier("@BusinessId", businessId),
                UniqueIdentifier("@InvitationId", invitationId)
            ],
            cancellationToken).ConfigureAwait(false);

        if (affected == 0)
        {
            throw new TeamRuleException("invitation_not_found", "The specified invitation does not exist or has already been resolved.");
        }

        await auditService.RecordAuditEventAsync(
            businessId,
            actorUserId,
            "team.invitation_revoked",
            "Invitation",
            invitationId,
            null,
            cancellationToken).ConfigureAwait(false);
    }

    private static SqlParameter UniqueIdentifier(string name, Guid value) => new(name, SqlDbType.UniqueIdentifier) { Value = value };
    private static SqlParameter NVarChar(string name, string? value, int size) =>
        size == -1
            ? new(name, SqlDbType.NVarChar, -1) { Value = value ?? (object)DBNull.Value }
            : new(name, SqlDbType.NVarChar, size) { Value = value ?? (object)DBNull.Value };
    private static SqlParameter Binary(string name, byte[] value, int size) => new(name, SqlDbType.Binary, size) { Value = value };
    private static SqlParameter DateTime2(string name, DateTime value) => new(name, SqlDbType.DateTime2) { Value = value };
}

internal sealed record SeatCapacityInfo(long? SeatLimit, int ActiveCount, int PendingCount);
internal sealed record DuplicateCheckInfo(bool MemberExists, bool InviteExists);
