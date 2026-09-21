namespace ServiceDesk.Application.Security;

public interface IEmailVerificationService
{
    Task IssueEmailOtpAsync(Guid userId, string email, CancellationToken cancellationToken);

    Task<bool> VerifyEmailOtpAsync(string email, string otp, CancellationToken cancellationToken);

    Task ResendEmailOtpAsync(string email, CancellationToken cancellationToken);
}
