namespace ServiceDesk.Application.Security;

public interface IAuthenticationService
{
    Task<RegisterResponse> RegisterAsync(RegisterRequest request, CancellationToken cancellationToken);

    Task<AuthTokenResponse> VerifyEmailOtpAndLoginAsync(VerifyEmailOtpRequest request, CancellationToken cancellationToken);

    Task<AuthTokenResponse> LoginAsync(LoginRequest request, CancellationToken cancellationToken);

    Task<AuthTokenResponse> GoogleLoginAsync(GoogleLoginRequest request, CancellationToken cancellationToken);

    Task<AuthTokenResponse> AppleLoginAsync(AppleLoginRequest request, CancellationToken cancellationToken);
}
