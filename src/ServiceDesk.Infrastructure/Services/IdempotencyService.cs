using System.Data;
using System.Security.Cryptography;
using System.Text;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Logging;
using ServiceDesk.Infrastructure.Data;

namespace ServiceDesk.Infrastructure.Services;

public interface IIdempotencyService
{
    Task<IdempotencyCheckResult> CheckAsync(
        Guid businessId,
        Guid actorUserId,
        string operation,
        string idempotencyKey,
        string requestPayload,
        CancellationToken cancellationToken = default);

    Task CompleteAsync(
        Guid businessId,
        Guid actorUserId,
        string operation,
        string idempotencyKey,
        int responseCode,
        string responseJson,
        CancellationToken cancellationToken = default);
}

public sealed record IdempotencyCheckResult(
    bool HasCachedResponse,
    bool IsInProgress,
    int? ResponseCode,
    string? ResponseJson);

public sealed class IdempotencyService(BaseDAL baseDAL, ILogger<IdempotencyService> logger) : IIdempotencyService
{
    private static readonly Action<ILogger, string, string, int, Exception?> LogIdempotentHit =
        LoggerMessage.Define<string, string, int>(
            LogLevel.Information,
            new EventId(2101, nameof(LogIdempotentHit)),
            "Idempotent hit for key {IdempotencyKey} on {Operation} - returning cached response {Code}");

    private static readonly Action<ILogger, string, Exception?> LogConcurrentInProgress =
        LoggerMessage.Define<string>(
            LogLevel.Warning,
            new EventId(2102, nameof(LogConcurrentInProgress)),
            "Concurrent request in progress for idempotency key {IdempotencyKey}");

    private static readonly Action<ILogger, string, Exception?> LogInsertFailed =
        LoggerMessage.Define<string>(
            LogLevel.Warning,
            new EventId(2103, nameof(LogInsertFailed)),
            "Failed to insert InProgress idempotency record for key {IdempotencyKey}");

    public static byte[] ComputeRequestHash(string payload) =>
        SHA256.HashData(Encoding.UTF8.GetBytes(payload ?? string.Empty));

    public async Task<IdempotencyCheckResult> CheckAsync(
        Guid businessId,
        Guid actorUserId,
        string operation,
        string idempotencyKey,
        string requestPayload,
        CancellationToken cancellationToken = default)
    {
        var requestHash = ComputeRequestHash(requestPayload);

        const string selectSql = """
            SELECT Status, ResponseCode, ResponseJson, ExpiresAt
            FROM app.IdempotencyRecords
            WHERE BusinessId = @BusinessId
              AND ActorUserId = @ActorUserId
              AND Operation = @Operation
              AND IdempotencyKey = @IdempotencyKey;
            """;

        var existing = await baseDAL.ExecuteSingleAsync(
            businessId,
            "Idempotency.Check",
            selectSql,
            reader => new ExistingRecord(
                reader.GetString(0),
                reader.IsDBNull(1) ? null : reader.GetInt32(1),
                reader.IsDBNull(2) ? null : reader.GetString(2),
                reader.GetDateTime(3)),
            [
                new SqlParameter("@BusinessId", SqlDbType.UniqueIdentifier) { Value = businessId },
                new SqlParameter("@ActorUserId", SqlDbType.UniqueIdentifier) { Value = actorUserId },
                new SqlParameter("@Operation", SqlDbType.NVarChar, 120) { Value = operation },
                new SqlParameter("@IdempotencyKey", SqlDbType.NVarChar, 100) { Value = idempotencyKey }
            ],
            cancellationToken);

        if (existing is not null)
        {
            if (existing.ExpiresAt > DateTime.UtcNow)
            {
                if (existing.Status == "Completed" && existing.ResponseCode.HasValue)
                {
                    LogIdempotentHit(logger, idempotencyKey, operation, existing.ResponseCode.Value, null);
                    return new IdempotencyCheckResult(true, false, existing.ResponseCode, existing.ResponseJson);
                }

                if (existing.Status == "InProgress")
                {
                    LogConcurrentInProgress(logger, idempotencyKey, null);
                    return new IdempotencyCheckResult(false, true, null, null);
                }
            }
            else
            {
                // Expired, delete record
                const string deleteSql = """
                    DELETE FROM app.IdempotencyRecords
                    WHERE BusinessId = @BusinessId
                      AND ActorUserId = @ActorUserId
                      AND Operation = @Operation
                      AND IdempotencyKey = @IdempotencyKey;
                    """;
                await baseDAL.ExecuteNonQueryAsync(
                    businessId,
                    "Idempotency.DeleteExpired",
                    deleteSql,
                    [
                        new SqlParameter("@BusinessId", SqlDbType.UniqueIdentifier) { Value = businessId },
                        new SqlParameter("@ActorUserId", SqlDbType.UniqueIdentifier) { Value = actorUserId },
                        new SqlParameter("@Operation", SqlDbType.NVarChar, 120) { Value = operation },
                        new SqlParameter("@IdempotencyKey", SqlDbType.NVarChar, 100) { Value = idempotencyKey }
                    ],
                    cancellationToken).ConfigureAwait(false);
            }
        }

        // Insert InProgress
        const string insertSql = """
            INSERT app.IdempotencyRecords
                (BusinessId, ActorUserId, Operation, IdempotencyKey, RequestHash, Status, ExpiresAt)
            VALUES
                (@BusinessId, @ActorUserId, @Operation, @IdempotencyKey, @RequestHash, 'InProgress', DATEADD(hour, 24, SYSUTCDATETIME()));
            """;

        try
        {
            await baseDAL.ExecuteNonQueryAsync(
                businessId,
                "Idempotency.InsertInProgress",
                insertSql,
                [
                    new SqlParameter("@BusinessId", SqlDbType.UniqueIdentifier) { Value = businessId },
                    new SqlParameter("@ActorUserId", SqlDbType.UniqueIdentifier) { Value = actorUserId },
                    new SqlParameter("@Operation", SqlDbType.NVarChar, 120) { Value = operation },
                    new SqlParameter("@IdempotencyKey", SqlDbType.NVarChar, 100) { Value = idempotencyKey },
                    new SqlParameter("@RequestHash", SqlDbType.Binary, 32) { Value = requestHash }
                ],
                cancellationToken).ConfigureAwait(false);
        }
        catch (Exception ex)
        {
            LogInsertFailed(logger, idempotencyKey, ex);
        }

        return new IdempotencyCheckResult(false, false, null, null);
    }

    public async Task CompleteAsync(
        Guid businessId,
        Guid actorUserId,
        string operation,
        string idempotencyKey,
        int responseCode,
        string responseJson,
        CancellationToken cancellationToken = default)
    {
        const string updateSql = """
            UPDATE app.IdempotencyRecords
            SET Status = 'Completed', ResponseCode = @ResponseCode, ResponseJson = @ResponseJson, UpdatedAt = SYSUTCDATETIME()
            WHERE BusinessId = @BusinessId
              AND ActorUserId = @ActorUserId
              AND Operation = @Operation
              AND IdempotencyKey = @IdempotencyKey;
            """;

        await baseDAL.ExecuteNonQueryAsync(
            businessId,
            "Idempotency.Complete",
            updateSql,
            [
                new SqlParameter("@BusinessId", SqlDbType.UniqueIdentifier) { Value = businessId },
                new SqlParameter("@ActorUserId", SqlDbType.UniqueIdentifier) { Value = actorUserId },
                new SqlParameter("@Operation", SqlDbType.NVarChar, 120) { Value = operation },
                new SqlParameter("@IdempotencyKey", SqlDbType.NVarChar, 100) { Value = idempotencyKey },
                new SqlParameter("@ResponseCode", SqlDbType.Int) { Value = responseCode },
                new SqlParameter("@ResponseJson", SqlDbType.NVarChar, -1) { Value = responseJson ?? (object)DBNull.Value }
            ],
            cancellationToken).ConfigureAwait(false);
    }

    private sealed record ExistingRecord(
        string Status,
        int? ResponseCode,
        string? ResponseJson,
        DateTime ExpiresAt);
}
