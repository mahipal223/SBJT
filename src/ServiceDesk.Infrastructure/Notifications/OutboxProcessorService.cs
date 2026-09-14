using System.Data;
using System.Text.Json;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using ServiceDesk.Infrastructure.Data;

namespace ServiceDesk.Infrastructure.Notifications;

public sealed class OutboxProcessorService(
    IServiceProvider serviceProvider,
    IConfiguration configuration,
    ILogger<OutboxProcessorService> logger) : BackgroundService
{
    private static readonly Action<ILogger, Exception?> LogStarted =
        LoggerMessage.Define(
            LogLevel.Information,
            new EventId(2201, nameof(LogStarted)),
            "OutboxProcessorService started.");

    private static readonly Action<ILogger, Exception?> LogStopped =
        LoggerMessage.Define(
            LogLevel.Information,
            new EventId(2202, nameof(LogStopped)),
            "OutboxProcessorService stopped.");

    private static readonly Action<ILogger, Exception?> LogProcessingError =
        LoggerMessage.Define(
            LogLevel.Error,
            new EventId(2203, nameof(LogProcessingError)),
            "Error processing outbox messages.");

    private static readonly Action<ILogger, int, Exception?> LogPendingFound =
        LoggerMessage.Define<int>(
            LogLevel.Information,
            new EventId(2204, nameof(LogPendingFound)),
            "Found {Count} pending outbox message(s) to process.");

    private static readonly Action<ILogger, Guid, string, Exception?> LogProcessed =
        LoggerMessage.Define<Guid, string>(
            LogLevel.Information,
            new EventId(2205, nameof(LogProcessed)),
            "Successfully processed outbox message {MessageId} ({EventType})");

    private static readonly Action<ILogger, Guid, Exception?> LogDeliveryFailed =
        LoggerMessage.Define<Guid>(
            LogLevel.Warning,
            new EventId(2206, nameof(LogDeliveryFailed)),
            "Failed to deliver outbox message {MessageId}. Recording failure.");

    private readonly string _connectionString = configuration.GetConnectionString("ServiceDesk")
        ?? throw new InvalidOperationException("ConnectionStrings:ServiceDesk is not configured.");

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        LogStarted(logger, null);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await ProcessPendingMessagesAsync(stoppingToken).ConfigureAwait(false);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                LogProcessingError(logger, ex);
            }

            try
            {
                await Task.Delay(4000, stoppingToken).ConfigureAwait(false);
            }
            catch (OperationCanceledException)
            {
                break;
            }
        }

        LogStopped(logger, null);
    }

    private async Task ProcessPendingMessagesAsync(CancellationToken stoppingToken)
    {
        var messages = new List<OutboxMessageDto>();

        await using (var connection = new SqlConnection(_connectionString))
        {
            await connection.OpenAsync(stoppingToken).ConfigureAwait(false);
            await using var command = connection.CreateCommand();
            command.CommandText = "EXEC app.sp_GetPendingOutboxMessages;";
            command.CommandType = CommandType.Text;

            await using var reader = await command.ExecuteReaderAsync(stoppingToken).ConfigureAwait(false);
            while (await reader.ReadAsync(stoppingToken).ConfigureAwait(false))
            {
                messages.Add(new OutboxMessageDto(
                    reader.GetGuid(0),
                    reader.GetGuid(1),
                    reader.GetString(2),
                    reader.GetString(3),
                    reader.GetInt32(4)));
            }
        }

        if (messages.Count == 0) return;

        LogPendingFound(logger, messages.Count, null);

        using var scope = serviceProvider.CreateScope();
        var emailSender = scope.ServiceProvider.GetRequiredService<IEmailSender>();
        var baseDal = scope.ServiceProvider.GetRequiredService<BaseDAL>();

        foreach (var msg in messages)
        {
            if (stoppingToken.IsCancellationRequested) break;

            try
            {
                using var jsonDoc = JsonDocument.Parse(msg.Payload);
                var root = jsonDoc.RootElement;

                var recipient = root.TryGetProperty("recipientEmail", out var r) ? r.GetString() ?? "" : "";
                var subject = root.TryGetProperty("subject", out var s) ? s.GetString() ?? "" : "ServiceDesk Notification";
                var body = root.TryGetProperty("body", out var b) ? b.GetString() ?? "" : "";
                var invoiceIdStr = root.TryGetProperty("invoiceId", out var inv) ? inv.GetString() : null;

                if (!string.IsNullOrWhiteSpace(recipient))
                {
                    await emailSender.SendEmailAsync(msg.BusinessId, recipient, subject, body, stoppingToken).ConfigureAwait(false);
                }

                // Mark processed
                await MarkProcessedAsync(msg.BusinessId, msg.Id, stoppingToken).ConfigureAwait(false);

                // Update invoice delivery status if applicable
                if (Guid.TryParse(invoiceIdStr, out var invoiceId))
                {
                    const string updateSql = """
                        UPDATE app.Invoices
                        SET DeliveryStatus = 'Sent', UpdatedAt = SYSUTCDATETIME()
                        WHERE BusinessId = @BusinessId AND Id = @InvoiceId;
                        """;
                    await baseDal.ExecuteNonQueryAsync(
                        msg.BusinessId,
                        "Invoices.UpdateDeliveryStatusSent",
                        updateSql,
                        [
                            new SqlParameter("@BusinessId", SqlDbType.UniqueIdentifier) { Value = msg.BusinessId },
                            new SqlParameter("@InvoiceId", SqlDbType.UniqueIdentifier) { Value = invoiceId }
                        ],
                        stoppingToken).ConfigureAwait(false);
                }

                LogProcessed(logger, msg.Id, msg.EventType, null);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                LogDeliveryFailed(logger, msg.Id, ex);
                await RecordFailureAsync(msg.BusinessId, msg.Id, stoppingToken).ConfigureAwait(false);

                if (msg.Attempts >= 2)
                {
                    try
                    {
                        using var doc = JsonDocument.Parse(msg.Payload);
                        if (doc.RootElement.TryGetProperty("invoiceId", out var inv) && Guid.TryParse(inv.GetString(), out var invoiceId))
                        {
                            const string failSql = """
                                UPDATE app.Invoices
                                SET DeliveryStatus = 'Failed', UpdatedAt = SYSUTCDATETIME()
                                WHERE BusinessId = @BusinessId AND Id = @InvoiceId;
                                """;
                            await baseDal.ExecuteNonQueryAsync(
                                msg.BusinessId,
                                "Invoices.UpdateDeliveryStatusFailed",
                                failSql,
                                [
                                    new SqlParameter("@BusinessId", SqlDbType.UniqueIdentifier) { Value = msg.BusinessId },
                                    new SqlParameter("@InvoiceId", SqlDbType.UniqueIdentifier) { Value = invoiceId }
                                ],
                                stoppingToken).ConfigureAwait(false);
                        }
                    }
                    catch
                    {
                        // best effort
                    }
                }
            }
        }
    }

    private async Task MarkProcessedAsync(Guid businessId, Guid id, CancellationToken stoppingToken)
    {
        await using var connection = new SqlConnection(_connectionString);
        await connection.OpenAsync(stoppingToken).ConfigureAwait(false);
        await using var cmd = connection.CreateCommand();
        cmd.CommandText = "EXEC app.sp_MarkOutboxMessageProcessed @BusinessId, @Id;";
        cmd.Parameters.Add(new SqlParameter("@BusinessId", SqlDbType.UniqueIdentifier) { Value = businessId });
        cmd.Parameters.Add(new SqlParameter("@Id", SqlDbType.UniqueIdentifier) { Value = id });
        await cmd.ExecuteNonQueryAsync(stoppingToken).ConfigureAwait(false);
    }

    private async Task RecordFailureAsync(Guid businessId, Guid id, CancellationToken stoppingToken)
    {
        await using var connection = new SqlConnection(_connectionString);
        await connection.OpenAsync(stoppingToken).ConfigureAwait(false);
        await using var cmd = connection.CreateCommand();
        cmd.CommandText = "EXEC app.sp_RecordOutboxMessageFailure @BusinessId, @Id;";
        cmd.Parameters.Add(new SqlParameter("@BusinessId", SqlDbType.UniqueIdentifier) { Value = businessId });
        cmd.Parameters.Add(new SqlParameter("@Id", SqlDbType.UniqueIdentifier) { Value = id });
        await cmd.ExecuteNonQueryAsync(stoppingToken).ConfigureAwait(false);
    }

    private sealed record OutboxMessageDto(
        Guid BusinessId,
        Guid Id,
        string EventType,
        string Payload,
        int Attempts);
}
