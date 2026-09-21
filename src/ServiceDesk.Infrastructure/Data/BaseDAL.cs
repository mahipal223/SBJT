using System.Data;
using System.Diagnostics;
using System.Globalization;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Logging;
using ServiceDesk.Application.Work;
using ServiceDesk.Application.Financials;
using ServiceDesk.Application.Security;

namespace ServiceDesk.Infrastructure.Data;

/// <summary>
/// Provides shared, tenant-safe SQL Server mechanics for Infrastructure feature services.
/// Business SQL stays beside the feature service method that executes and maps it.
/// </summary>
public sealed class BaseDAL
{
    public BaseDAL(string connectionString, ILogger<BaseDAL> logger)
        : this(connectionString, null, logger)
    {
    }

    public BaseDAL(string connectionString, string? platformConnectionString, ILogger<BaseDAL> logger)
    {
        this.connectionString = connectionString;
        this.platformConnectionString = platformConnectionString;
        this.logger = logger;
    }

    private readonly string connectionString;
    private readonly string? platformConnectionString;
    private readonly ILogger<BaseDAL> logger;
    private const int DefaultCommandTimeoutSeconds = 30;
    private static readonly Action<ILogger, string, long, Exception?> OperationCompleted =
        LoggerMessage.Define<string, long>(
            LogLevel.Debug,
            new EventId(1001, nameof(OperationCompleted)),
            "SQL operation {OperationName} completed in {ElapsedMilliseconds} ms.");
    private static readonly Action<ILogger, string, long, Exception?> OperationFailed =
        LoggerMessage.Define<string, long>(
            LogLevel.Error,
            new EventId(1002, nameof(OperationFailed)),
            "SQL operation {OperationName} failed after {ElapsedMilliseconds} ms.");

    public async Task<bool> CanConnectAsync(CancellationToken cancellationToken = default)
    {
        try
        {
            await using var connection = new SqlConnection(connectionString);
            await connection.OpenAsync(cancellationToken).ConfigureAwait(false);
            await using var command = connection.CreateCommand();
            command.CommandText = "SELECT 1;";
            command.CommandTimeout = 5;
            return Convert.ToInt32(await command.ExecuteScalarAsync(cancellationToken).ConfigureAwait(false), CultureInfo.InvariantCulture) == 1;
        }
        catch (Exception exception) when (exception is not OperationCanceledException)
        {
            OperationFailed(logger, "Database.Readiness", 0, exception);
            return false;
        }
    }

    public async Task<SqlConnection> OpenConnectionAsync(
        Guid businessId,
        CancellationToken cancellationToken = default)
    {
        if (businessId == Guid.Empty)
        {
            return await OpenPlatformConnectionAsync(cancellationToken).ConfigureAwait(false);
        }

        var connection = new SqlConnection(connectionString);

        try
        {
            await connection.OpenAsync(cancellationToken).ConfigureAwait(false);
            await SetTenantContextAsync(connection, businessId, cancellationToken).ConfigureAwait(false);
            return connection;
        }
        catch
        {
            await connection.DisposeAsync().ConfigureAwait(false);
            throw;
        }
    }

    // ─── Tenant-scoped operations (sets SESSION_CONTEXT(BusinessId)) ─────────

    public async Task<int> ExecuteNonQueryAsync(
        Guid businessId,
        string operationName,
        string sql,
        IReadOnlyCollection<SqlParameter>? parameters = null,
        CancellationToken cancellationToken = default)
    {
        return await ExecuteAsync(operationName, async () =>
        {
            await using var connection = await OpenConnectionAsync(businessId, cancellationToken).ConfigureAwait(false);
            await using var command = BuildCommand(connection, null, sql, CommandType.Text, parameters);
            return await command.ExecuteNonQueryAsync(cancellationToken).ConfigureAwait(false);
        }).ConfigureAwait(false);
    }

    public async Task<T?> ExecuteScalarAsync<T>(
        Guid businessId,
        string operationName,
        string sql,
        IReadOnlyCollection<SqlParameter>? parameters = null,
        CancellationToken cancellationToken = default)
    {
        var value = await ExecuteAsync(operationName, async () =>
        {
            await using var connection = await OpenConnectionAsync(businessId, cancellationToken).ConfigureAwait(false);
            await using var command = BuildCommand(connection, null, sql, CommandType.Text, parameters);
            return await command.ExecuteScalarAsync(cancellationToken).ConfigureAwait(false);
        }).ConfigureAwait(false);

        if (value is null or DBNull)
        {
            return default;
        }

        return (T)Convert.ChangeType(value, typeof(T), CultureInfo.InvariantCulture);
    }

    public async Task<IReadOnlyList<T>> ExecuteQueryAsync<T>(
        Guid businessId,
        string operationName,
        string sql,
        Func<SqlDataReader, T> map,
        IReadOnlyCollection<SqlParameter>? parameters = null,
        CancellationToken cancellationToken = default)
    {
        return await ExecuteAsync(operationName, async () =>
        {
            await using var connection = await OpenConnectionAsync(businessId, cancellationToken).ConfigureAwait(false);
            await using var command = BuildCommand(connection, null, sql, CommandType.Text, parameters);
            await using var reader = await command.ExecuteReaderAsync(cancellationToken).ConfigureAwait(false);
            var results = new List<T>();

            while (await reader.ReadAsync(cancellationToken).ConfigureAwait(false))
            {
                results.Add(map(reader));
            }

            return (IReadOnlyList<T>)results;
        }).ConfigureAwait(false);
    }

    public async Task<T?> ExecuteSingleAsync<T>(
        Guid businessId,
        string operationName,
        string sql,
        Func<SqlDataReader, T> map,
        IReadOnlyCollection<SqlParameter>? parameters = null,
        CancellationToken cancellationToken = default)
        where T : class
    {
        var rows = await ExecuteQueryAsync(
            businessId,
            operationName,
            sql,
            map,
            parameters,
            cancellationToken).ConfigureAwait(false);

        return rows.Count switch
        {
            0 => null,
            1 => rows[0],
            _ => throw new DataAccessException(
                operationName,
                new InvalidOperationException("The query returned more than one row."))
        };
    }

    // ─── Platform-scoped operations (no tenant context — control-plane only) ─

    public async Task<IReadOnlyList<T>> ExecutePlatformQueryAsync<T>(
        string operationName,
        string sql,
        Func<SqlDataReader, T> map,
        IReadOnlyCollection<SqlParameter>? parameters = null,
        CancellationToken cancellationToken = default)
    {
        return await ExecuteAsync(operationName, async () =>
        {
            await using var connection = await OpenPlatformConnectionAsync(cancellationToken).ConfigureAwait(false);
            await using var command = BuildCommand(connection, null, sql, CommandType.Text, parameters);
            await using var reader = await command.ExecuteReaderAsync(cancellationToken).ConfigureAwait(false);
            var results = new List<T>();
            while (await reader.ReadAsync(cancellationToken).ConfigureAwait(false))
            {
                results.Add(map(reader));
            }

            return (IReadOnlyList<T>)results;
        }).ConfigureAwait(false);
    }

    public async Task<T?> ExecutePlatformSingleAsync<T>(
        string operationName,
        string sql,
        Func<SqlDataReader, T> map,
        IReadOnlyCollection<SqlParameter>? parameters = null,
        CancellationToken cancellationToken = default)
        where T : class
    {
        var rows = await ExecutePlatformQueryAsync(operationName, sql, map, parameters, cancellationToken).ConfigureAwait(false);
        return rows.Count switch
        {
            0 => null,
            1 => rows[0],
            _ => throw new DataAccessException(operationName, new InvalidOperationException("Platform query returned more than one row."))
        };
    }

    public async Task<T> ExecutePlatformInTransactionAsync<T>(
        string operationName,
        Func<SqlConnection, SqlTransaction, CancellationToken, Task<T>> operation,
        IsolationLevel isolationLevel = IsolationLevel.ReadCommitted,
        CancellationToken cancellationToken = default)
    {
        return await ExecuteAsync(operationName, async () =>
        {
            await using var connection = await OpenPlatformConnectionAsync(cancellationToken).ConfigureAwait(false);
            await using var transaction = (SqlTransaction)await connection
                .BeginTransactionAsync(isolationLevel, cancellationToken).ConfigureAwait(false);
            try
            {
                var result = await operation(connection, transaction, cancellationToken).ConfigureAwait(false);
                await transaction.CommitAsync(cancellationToken).ConfigureAwait(false);
                return result;
            }
            catch
            {
                await transaction.RollbackAsync(CancellationToken.None).ConfigureAwait(false);
                throw;
            }
        }).ConfigureAwait(false);
    }

    public async Task<SqlConnection> OpenPlatformConnectionAsync(CancellationToken cancellationToken = default)
    {
        var targetConnectionString = !string.IsNullOrWhiteSpace(platformConnectionString)
            ? platformConnectionString
            : connectionString;

        var connection = new SqlConnection(targetConnectionString);
        try
        {
            await connection.OpenAsync(cancellationToken).ConfigureAwait(false);
            await SetPlatformContextAsync(connection, cancellationToken).ConfigureAwait(false);
            return connection;
        }
        catch
        {
            await connection.DisposeAsync().ConfigureAwait(false);
            throw;
        }
    }

    public static async Task ClearTenantContextAsync(
        SqlConnection connection,
        CancellationToken cancellationToken,
        SqlTransaction? transaction = null)
    {
        const string sql = """
            EXEC sys.sp_set_session_context
                @key = N'BusinessId',
                @value = NULL,
                @read_only = 0;
            EXEC sys.sp_set_session_context
                @key = N'IsPlatformAdmin',
                @value = 0,
                @read_only = 0;
            """;

        await using var command = connection.CreateCommand();
        if (transaction is not null)
        {
            command.Transaction = transaction;
        }

        command.CommandText = sql;
        command.CommandTimeout = DefaultCommandTimeoutSeconds;
        await command.ExecuteNonQueryAsync(cancellationToken).ConfigureAwait(false);
    }

    public static async Task SetPlatformContextAsync(
        SqlConnection connection,
        CancellationToken cancellationToken,
        SqlTransaction? transaction = null)
    {
        const string sql = """
            EXEC sys.sp_set_session_context
                @key = N'BusinessId',
                @value = NULL,
                @read_only = 0;
            EXEC sys.sp_set_session_context
                @key = N'IsPlatformAdmin',
                @value = 1,
                @read_only = 0;
            """;

        await using var command = connection.CreateCommand();
        if (transaction is not null)
        {
            command.Transaction = transaction;
        }

        command.CommandText = sql;
        command.CommandTimeout = DefaultCommandTimeoutSeconds;
        await command.ExecuteNonQueryAsync(cancellationToken).ConfigureAwait(false);
    }

    // ─── Shared infrastructure ──────────────────────────────────────────────

    public async Task<T> ExecuteInTransactionAsync<T>(
        Guid businessId,
        string operationName,
        Func<SqlConnection, SqlTransaction, CancellationToken, Task<T>> operation,
        IsolationLevel isolationLevel = IsolationLevel.ReadCommitted,
        CancellationToken cancellationToken = default)
    {
        return await ExecuteAsync(operationName, async () =>
        {
            await using var connection = await OpenConnectionAsync(businessId, cancellationToken).ConfigureAwait(false);
            await using var transaction = (SqlTransaction)await connection
                .BeginTransactionAsync(isolationLevel, cancellationToken).ConfigureAwait(false);

            try
            {
                var result = await operation(connection, transaction, cancellationToken).ConfigureAwait(false);
                await transaction.CommitAsync(cancellationToken).ConfigureAwait(false);
                return result;
            }
            catch
            {
                await transaction.RollbackAsync(CancellationToken.None).ConfigureAwait(false);
                throw;
            }
        }).ConfigureAwait(false);
    }

    public static SqlCommand BuildCommand(
        SqlConnection connection,
        SqlTransaction? transaction,
        string sql,
        CommandType commandType = CommandType.Text,
        IReadOnlyCollection<SqlParameter>? parameters = null,
        int commandTimeoutSeconds = DefaultCommandTimeoutSeconds)
    {
        var command = connection.CreateCommand();
        command.Transaction = transaction;
        command.CommandText = sql;
        command.CommandType = commandType;
        command.CommandTimeout = commandTimeoutSeconds;

        if (parameters is not null)
        {
            command.Parameters.AddRange(parameters.ToArray());
        }

        return command;
    }

    private async Task<T> ExecuteAsync<T>(string operationName, Func<Task<T>> operation)
    {
        var stopwatch = Stopwatch.StartNew();

        try
        {
            var result = await operation().ConfigureAwait(false);
            OperationCompleted(logger, operationName, stopwatch.ElapsedMilliseconds, null);
            return result;
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (DataAccessException)
        {
            throw;
        }
        catch (WorkRuleException)
        {
            throw;
        }
        catch (FinancialRuleException)
        {
            throw;
        }
        catch (AuthRuleException)
        {
            throw;
        }
        catch (Exception exception)
        {
            OperationFailed(logger, operationName, stopwatch.ElapsedMilliseconds, exception);
            throw new DataAccessException(operationName, exception);
        }
    }

    public static async Task SetTenantContextAsync(
        SqlConnection connection,
        Guid businessId,
        CancellationToken cancellationToken,
        SqlTransaction? transaction = null)
    {
        const string sql = """
            EXEC sys.sp_set_session_context
                @key = N'IsPlatformAdmin',
                @value = 0,
                @read_only = 0;
            EXEC sys.sp_set_session_context
                @key = N'BusinessId',
                @value = @BusinessId,
                @read_only = 0;
            """;

        await using var command = connection.CreateCommand();
        if (transaction is not null)
        {
            command.Transaction = transaction;
        }

        command.CommandText = sql;
        command.CommandTimeout = DefaultCommandTimeoutSeconds;
        command.Parameters.Add(new SqlParameter("@BusinessId", SqlDbType.UniqueIdentifier)
        {
            Value = businessId
        });
        await command.ExecuteNonQueryAsync(cancellationToken).ConfigureAwait(false);
    }
}
