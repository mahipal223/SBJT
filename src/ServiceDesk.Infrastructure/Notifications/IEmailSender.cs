namespace ServiceDesk.Infrastructure.Notifications;

public interface IEmailSender
{
    Task SendEmailAsync(
        Guid businessId,
        string recipientEmail,
        string subject,
        string body,
        CancellationToken cancellationToken = default);

    Task<bool> SendTestEmailAsync(
        string host,
        int port,
        string username,
        string password,
        string fromEmail,
        string fromName,
        bool enableSsl,
        string targetEmail,
        CancellationToken cancellationToken = default);
}
