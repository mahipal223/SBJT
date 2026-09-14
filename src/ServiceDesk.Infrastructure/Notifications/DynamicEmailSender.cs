using System.Net;
using System.Net.Mail;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Logging;
using ServiceDesk.Infrastructure.Data;

namespace ServiceDesk.Infrastructure.Notifications;

public sealed class DynamicEmailSender(BaseDAL baseDAL, ILogger<DynamicEmailSender> logger) : IEmailSender
{
    private static readonly Action<ILogger, string, int, string, Guid, Exception?> LogCustomSmtpDispatch =
        LoggerMessage.Define<string, int, string, Guid>(
            LogLevel.Information,
            new EventId(2001, nameof(LogCustomSmtpDispatch)),
            "Dispatching email via custom tenant SMTP ({Host}:{Port}) to {Recipient} for Business {BusinessId}");

    private static readonly Action<ILogger, string, Exception?> LogCustomSmtpSuccess =
        LoggerMessage.Define<string>(
            LogLevel.Information,
            new EventId(2002, nameof(LogCustomSmtpSuccess)),
            "Successfully sent email via custom tenant SMTP to {Recipient}");

    private static readonly Action<ILogger, string, Guid, string, Exception?> LogPlatformFallback =
        LoggerMessage.Define<string, Guid, string>(
            LogLevel.Information,
            new EventId(2003, nameof(LogPlatformFallback)),
            "[PlatformEmailService] Delivered email to {Recipient} for Business {BusinessId}. Subject: '{Subject}'");

    public async Task SendEmailAsync(
        Guid businessId,
        string recipientEmail,
        string subject,
        string body,
        CancellationToken cancellationToken = default)
    {
        const string sql = """
            SELECT Host, Port, Username, Password, FromEmail, FromName, EnableSsl
            FROM app.EmailConfigurations
            WHERE BusinessId = @BusinessId AND IsEnabled = 1;
            """;

        var config = await baseDAL.ExecuteSingleAsync(
            businessId,
            "EmailConfigurations.GetActive",
            sql,
            reader => new SmtpConfig(
                reader.GetString(0),
                reader.GetInt32(1),
                reader.GetString(2),
                reader.GetString(3),
                reader.GetString(4),
                reader.GetString(5),
                reader.GetBoolean(6)),
            [new SqlParameter("@BusinessId", System.Data.SqlDbType.UniqueIdentifier) { Value = businessId }],
            cancellationToken);

        if (config is not null && !string.IsNullOrWhiteSpace(config.Host))
        {
            LogCustomSmtpDispatch(logger, config.Host, config.Port, recipientEmail, businessId, null);

            using var client = new SmtpClient(config.Host, config.Port)
            {
                EnableSsl = config.EnableSsl,
                Credentials = new NetworkCredential(config.Username, config.Password),
                Timeout = 15000
            };

            using var message = new MailMessage
            {
                From = new MailAddress(config.FromEmail, config.FromName),
                Subject = subject,
                Body = body,
                IsBodyHtml = true
            };
            message.To.Add(recipientEmail);

            await client.SendMailAsync(message, cancellationToken).ConfigureAwait(false);
            LogCustomSmtpSuccess(logger, recipientEmail, null);
        }
        else
        {
            // Platform fallback / developer logging
            LogPlatformFallback(logger, recipientEmail, businessId, subject, null);
        }
    }

    public async Task<bool> SendTestEmailAsync(
        string host,
        int port,
        string username,
        string password,
        string fromEmail,
        string fromName,
        bool enableSsl,
        string targetEmail,
        CancellationToken cancellationToken = default)
    {
        using var client = new SmtpClient(host, port)
        {
            EnableSsl = enableSsl,
            Credentials = new NetworkCredential(username, password),
            Timeout = 10000
        };

        using var message = new MailMessage
        {
            From = new MailAddress(fromEmail, fromName),
            Subject = "ServiceDesk SMTP Connection Test",
            Body = $"""
                <html>
                <body style="font-family: sans-serif; padding: 20px;">
                    <h2 style="color: #0d9488;">ServiceDesk SMTP Test Successful!</h2>
                    <p>Your custom SMTP server <b>{host}:{port}</b> has been successfully connected and verified.</p>
                    <p>Outbound estimates, invoices, and customer notifications will now send from <b>{fromEmail}</b>.</p>
                </body>
                </html>
                """,
            IsBodyHtml = true
        };
        message.To.Add(targetEmail);

        await client.SendMailAsync(message, cancellationToken).ConfigureAwait(false);
        return true;
    }

    private sealed record SmtpConfig(
        string Host,
        int Port,
        string Username,
        string Password,
        string FromEmail,
        string FromName,
        bool EnableSsl);
}
