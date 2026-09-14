using System.Data;
using Microsoft.Data.SqlClient;
using ServiceDesk.Application.DataControls;
using ServiceDesk.Infrastructure.Data;

namespace ServiceDesk.Infrastructure.Services;

public sealed class AuditService(BaseDAL baseDAL) : IAuditService
{
    public async Task RecordAuditEventAsync(
        Guid businessId,
        Guid? actorUserId,
        string action,
        string entityType,
        Guid? entityId,
        string? changes,
        CancellationToken cancellationToken = default)
    {
        const string sql = """
            INSERT INTO app.AuditEvents
                (BusinessId, ActorUserId, Action, EntityType, EntityId, CorrelationId, Changes)
            VALUES
                (@BusinessId, @ActorUserId, @Action, @EntityType, @EntityId, CONVERT(nvarchar(100), NEWID()), @Changes);
            """;

        await baseDAL.ExecuteNonQueryAsync(
            businessId,
            "AuditEvents.Record",
            sql,
            [
                UniqueIdentifier("@BusinessId", businessId),
                actorUserId.HasValue ? UniqueIdentifier("@ActorUserId", actorUserId.Value) : NullUniqueIdentifier("@ActorUserId"),
                NVarChar("@Action", action, 100),
                NVarChar("@EntityType", entityType, 80),
                entityId.HasValue ? UniqueIdentifier("@EntityId", entityId.Value) : NullUniqueIdentifier("@EntityId"),
                NVarChar("@Changes", string.IsNullOrWhiteSpace(changes) ? "{}" : changes, -1)
            ],
            cancellationToken).ConfigureAwait(false);
    }

    public Task<IReadOnlyList<AuditEventResponse>> ListAuditEventsAsync(
        Guid businessId,
        int limit,
        CancellationToken cancellationToken = default)
    {
        var safeLimit = Math.Clamp(limit, 1, 100);
        const string sql = """
            SELECT TOP (@Limit)
                Id,
                ActorUserId,
                Action,
                EntityType,
                EntityId,
                Changes,
                CreatedAt
            FROM app.AuditEvents
            WHERE BusinessId = @BusinessId
            ORDER BY CreatedAt DESC;
            """;

        return baseDAL.ExecuteQueryAsync(
            businessId,
            "AuditEvents.List",
            sql,
            reader => new AuditEventResponse(
                reader.GetGuid(0),
                reader.IsDBNull(1) ? null : reader.GetGuid(1),
                reader.GetString(2),
                reader.GetString(3),
                reader.IsDBNull(4) ? null : reader.GetGuid(4),
                reader.IsDBNull(5) ? null : reader.GetString(5),
                new DateTimeOffset(DateTime.SpecifyKind(reader.GetDateTime(6), DateTimeKind.Utc))),
            [
                UniqueIdentifier("@BusinessId", businessId),
                Int("@Limit", safeLimit)
            ],
            cancellationToken);
    }

    private static SqlParameter Int(string name, int value) => new(name, SqlDbType.Int) { Value = value };
    private static SqlParameter UniqueIdentifier(string name, Guid value) => new(name, SqlDbType.UniqueIdentifier) { Value = value };
    private static SqlParameter NullUniqueIdentifier(string name) => new(name, SqlDbType.UniqueIdentifier) { Value = DBNull.Value };
    private static SqlParameter NVarChar(string name, string? value, int size) =>
        size == -1
            ? new(name, SqlDbType.NVarChar, -1) { Value = value ?? (object)DBNull.Value }
            : new(name, SqlDbType.NVarChar, size) { Value = value ?? (object)DBNull.Value };
}
