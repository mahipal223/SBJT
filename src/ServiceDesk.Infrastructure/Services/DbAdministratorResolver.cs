using System.Data;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using ServiceDesk.Application.Platform;
using ServiceDesk.Infrastructure.Data;

namespace ServiceDesk.Infrastructure.Services;

public sealed class DbAdministratorResolver(
    IServiceProvider serviceProvider,
    IConfiguration configuration,
    ILogger<DbAdministratorResolver> logger) : IAdministratorResolver
{
    private static readonly Action<ILogger, Guid, Exception?> LogResolveFallback =
        LoggerMessage.Define<Guid>(
            LogLevel.Warning,
            new EventId(1301, nameof(LogResolveFallback)),
            "Failed to resolve platform administrator from SQL for user {UserId}. Falling back to configuration.");

    public async ValueTask<PlatformAdministratorRecord?> ResolveAsync(
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
                        a.UserId,
                        u.FullName,
                        u.Email,
                        a.RoleCode,
                        a.IsActive
                    FROM platform.Administrators AS a
                    INNER JOIN auth.Users AS u ON u.Id = a.UserId
                    WHERE a.UserId = @UserId AND a.IsActive = 1;
                    """;

                var record = await baseDAL.ExecutePlatformSingleAsync(
                    "Platform.Administrator.Resolve",
                    sql,
                    reader => new PlatformAdministratorRecord(
                        reader.GetGuid(reader.GetOrdinal("UserId")),
                        reader.GetString(reader.GetOrdinal("FullName")),
                        reader.GetString(reader.GetOrdinal("Email")),
                        reader.GetString(reader.GetOrdinal("RoleCode")),
                        reader.GetBoolean(reader.GetOrdinal("IsActive"))),
                    [
                        new SqlParameter("@UserId", SqlDbType.UniqueIdentifier) { Value = userId }
                    ],
                    cancellationToken).ConfigureAwait(false);

                if (record is not null)
                {
                    return record;
                }
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                LogResolveFallback(logger, userId, ex);
            }
        }

        // Fallback to configuration demo administrators (development only)
        return GetDemoAdministrator(userId);
    }

    private PlatformAdministratorRecord? GetDemoAdministrator(Guid userId)
    {
        var enabled = configuration.GetValue<bool>("PlatformAdmin:EnableDevAuthentication");
        if (!enabled)
        {
            return null;
        }

        var demoAdmins = configuration.GetSection("PlatformAdmin:DemoAdministrators").Get<List<DemoAdminConfig>>()
            ?? [];

        var match = demoAdmins.FirstOrDefault(a => a.UserId == userId && a.IsActive);
        if (match is null)
        {
            return null;
        }

        return new PlatformAdministratorRecord(
            match.UserId,
            match.FullName,
            match.Email,
            match.RoleCode,
            match.IsActive);
    }

    private sealed class DemoAdminConfig
    {
        public Guid UserId { get; set; }
        public string Email { get; set; } = string.Empty;
        public string FullName { get; set; } = string.Empty;
        public string RoleCode { get; set; } = string.Empty;
        public bool IsActive { get; set; }
    }
}
