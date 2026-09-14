using System.Data;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using ServiceDesk.Application.Abstractions;
using ServiceDesk.Application.Tenancy;
using ServiceDesk.Domain.Identity;
using ServiceDesk.Infrastructure.Data;

namespace ServiceDesk.Infrastructure.Tenancy;

/// <summary>
/// Resolves tenant memberships from SQL Server tables (app.Members, platform.Businesses, auth.RolePermissions).
/// Gracefully falls back to configuration-based demo memberships when SQL is unavailable or in development.
/// </summary>
public sealed class DbMembershipResolver(
    IServiceProvider serviceProvider,
    IConfiguration configuration,
    ILogger<DbMembershipResolver> logger) : IMembershipResolver
{
    private static readonly Action<ILogger, Guid, Guid, Exception?> LogResolveFallback =
        LoggerMessage.Define<Guid, Guid>(
            LogLevel.Warning,
            new EventId(1201, nameof(LogResolveFallback)),
            "Failed to resolve membership from SQL for user {UserId} in business {BusinessId}. Falling back to configuration.");

    private static readonly Action<ILogger, Guid, Exception?> LogListFallback =
        LoggerMessage.Define<Guid>(
            LogLevel.Warning,
            new EventId(1202, nameof(LogListFallback)),
            "Failed to list memberships from SQL for user {UserId}. Falling back to configuration.");

    private sealed record MemberPermissionRow(
        Guid BusinessId,
        string BusinessName,
        Guid UserId,
        Guid MemberId,
        string RoleCode,
        bool IsActive,
        string? PermissionCode);

    public async ValueTask<MembershipAccess?> ResolveAsync(
        Guid userId,
        Guid businessId,
        CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();

        var baseDAL = (BaseDAL?)serviceProvider.GetService(typeof(BaseDAL));
        if (baseDAL is not null)
        {
            try
            {
                const string sql = """
                    SELECT
                        m.BusinessId,
                        b.Name AS BusinessName,
                        m.UserId,
                        m.Id AS MemberId,
                        m.RoleCode,
                        CASE WHEN m.Status = 'Active' AND b.Status = 'Active' THEN 1 ELSE 0 END AS IsActive,
                        rp.PermissionCode
                    FROM app.Members AS m
                    INNER JOIN platform.Businesses AS b ON b.Id = m.BusinessId
                    LEFT JOIN auth.RolePermissions AS rp ON rp.RoleCode = m.RoleCode
                    WHERE m.UserId = @UserId AND m.BusinessId = @BusinessId;
                    """;

                var rows = await baseDAL.ExecutePlatformQueryAsync(
                    "Membership.Resolve",
                    sql,
                    reader => new MemberPermissionRow(
                        reader.GetGuid(reader.GetOrdinal("BusinessId")),
                        reader.GetString(reader.GetOrdinal("BusinessName")),
                        reader.GetGuid(reader.GetOrdinal("UserId")),
                        reader.GetGuid(reader.GetOrdinal("MemberId")),
                        reader.GetString(reader.GetOrdinal("RoleCode")),
                        reader.GetInt32(reader.GetOrdinal("IsActive")) == 1,
                        reader.IsDBNull(reader.GetOrdinal("PermissionCode")) ? null : reader.GetString(reader.GetOrdinal("PermissionCode"))),
                    [
                        new SqlParameter("@UserId", SqlDbType.UniqueIdentifier) { Value = userId },
                        new SqlParameter("@BusinessId", SqlDbType.UniqueIdentifier) { Value = businessId }
                    ],
                    cancellationToken).ConfigureAwait(false);

                if (rows.Count > 0)
                {
                    return AggregateMembership(rows);
                }
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                LogResolveFallback(logger, userId, businessId, ex);
            }
        }

        // Fallback to configuration demo tenancy
        var demo = GetDemoMemberships().FirstOrDefault(m => m.UserId == userId && m.BusinessId == businessId);
        return demo;
    }

    public async ValueTask<IReadOnlyList<MembershipAccess>> ListForUserAsync(
        Guid userId,
        CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();

        var baseDAL = (BaseDAL?)serviceProvider.GetService(typeof(BaseDAL));
        if (baseDAL is not null)
        {
            try
            {
                const string sql = """
                    SELECT
                        m.BusinessId,
                        b.Name AS BusinessName,
                        m.UserId,
                        m.Id AS MemberId,
                        m.RoleCode,
                        CASE WHEN m.Status = 'Active' AND b.Status = 'Active' THEN 1 ELSE 0 END AS IsActive,
                        rp.PermissionCode
                    FROM app.Members AS m
                    INNER JOIN platform.Businesses AS b ON b.Id = m.BusinessId
                    LEFT JOIN auth.RolePermissions AS rp ON rp.RoleCode = m.RoleCode
                    WHERE m.UserId = @UserId AND m.Status = 'Active' AND b.Status = 'Active'
                    ORDER BY m.CreatedAt ASC;
                    """;

                var rows = await baseDAL.ExecutePlatformQueryAsync(
                    "Membership.ListForUser",
                    sql,
                    reader => new MemberPermissionRow(
                        reader.GetGuid(reader.GetOrdinal("BusinessId")),
                        reader.GetString(reader.GetOrdinal("BusinessName")),
                        reader.GetGuid(reader.GetOrdinal("UserId")),
                        reader.GetGuid(reader.GetOrdinal("MemberId")),
                        reader.GetString(reader.GetOrdinal("RoleCode")),
                        reader.GetInt32(reader.GetOrdinal("IsActive")) == 1,
                        reader.IsDBNull(reader.GetOrdinal("PermissionCode")) ? null : reader.GetString(reader.GetOrdinal("PermissionCode"))),
                    [
                        new SqlParameter("@UserId", SqlDbType.UniqueIdentifier) { Value = userId }
                    ],
                    cancellationToken).ConfigureAwait(false);

                if (rows.Count > 0)
                {
                    return AggregateMemberships(rows);
                }
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                LogListFallback(logger, userId, ex);
            }
        }

        // Fallback to configuration demo tenancy
        IReadOnlyList<MembershipAccess> demo = GetDemoMemberships()
            .Where(m => m.UserId == userId && m.IsActive)
            .ToArray();
        return demo;
    }

    private static MembershipAccess AggregateMembership(IReadOnlyList<MemberPermissionRow> rows)
    {
        var first = rows[0];
        var permissions = rows
            .Where(r => !string.IsNullOrEmpty(r.PermissionCode))
            .Select(r => r.PermissionCode!)
            .ToHashSet(StringComparer.Ordinal);

        var role = Enum.TryParse<BusinessRole>(first.RoleCode, ignoreCase: true, out var parsedRole)
            ? parsedRole
            : BusinessRole.Technician;

        return new MembershipAccess(
            first.BusinessId,
            first.BusinessName,
            first.UserId,
            first.MemberId,
            role,
            first.IsActive,
            permissions);
    }

    private static List<MembershipAccess> AggregateMemberships(IReadOnlyList<MemberPermissionRow> rows)
    {
        return rows
            .GroupBy(r => (r.BusinessId, r.BusinessName, r.UserId, r.MemberId, r.RoleCode, r.IsActive))
            .Select(g =>
            {
                var role = Enum.TryParse<BusinessRole>(g.Key.RoleCode, ignoreCase: true, out var parsedRole)
                    ? parsedRole
                    : BusinessRole.Technician;

                var perms = g
                    .Where(r => !string.IsNullOrEmpty(r.PermissionCode))
                    .Select(r => r.PermissionCode!)
                    .ToHashSet(StringComparer.Ordinal);

                return new MembershipAccess(
                    g.Key.BusinessId,
                    g.Key.BusinessName,
                    g.Key.UserId,
                    g.Key.MemberId,
                    role,
                    g.Key.IsActive,
                    perms);
            })
            .ToList();
    }

    private sealed class DemoMembershipConfig
    {
        public Guid BusinessId { get; set; }
        public string BusinessName { get; set; } = string.Empty;
        public Guid UserId { get; set; }
        public Guid MemberId { get; set; }
        public string Role { get; set; } = string.Empty;
        public bool IsActive { get; set; }
        public List<string> Permissions { get; set; } = [];
    }

    private sealed class DemoTenancyOptions
    {
        public List<DemoMembershipConfig> Memberships { get; set; } = [];
    }

    private MembershipAccess[] GetDemoMemberships()
    {
        var options = configuration.GetSection("DemoTenancy").Get<DemoTenancyOptions>()
            ?? new DemoTenancyOptions();

        return options.Memberships.Select(member => new MembershipAccess(
            member.BusinessId,
            member.BusinessName,
            member.UserId,
            member.MemberId,
            Enum.TryParse<BusinessRole>(member.Role, ignoreCase: true, out var parsed) ? parsed : BusinessRole.Owner,
            member.IsActive,
            member.Permissions.ToHashSet(StringComparer.Ordinal))).ToArray();
    }
}
