namespace ServiceDesk.Application.Security;

public sealed record PasswordPolicyResponse(
    int MinLength,
    int MaxLength,
    bool RequireUppercase,
    bool RequireLowercase,
    bool RequireDigit,
    bool RequireNonAlphanumeric,
    int MaxFailedAccessAttempts,
    int LockoutDurationMinutes,
    int? PasswordExpirationDays,
    int PreventPasswordReuseCount,
    DateTime UpdatedAt);

public sealed record UpdatePasswordPolicyRequest(
    int MinLength,
    int MaxLength,
    bool RequireUppercase,
    bool RequireLowercase,
    bool RequireDigit,
    bool RequireNonAlphanumeric,
    int MaxFailedAccessAttempts,
    int LockoutDurationMinutes,
    int? PasswordExpirationDays,
    int PreventPasswordReuseCount);

public sealed record RegisterRequest(
    string Email,
    string Password,
    string FullName);

public sealed record RegisterResponse(
    Guid UserId,
    string Email,
    string Status);

public sealed record LoginRequest(
    string Email,
    string Password);

public sealed record VerifyEmailOtpRequest(
    string Email,
    string Otp);

public sealed record ResendEmailOtpRequest(
    string Email);

/// <summary>
/// Supports two Google Sign-In flows:
/// 1. <c>IdToken</c> – direct id_token from Google One Tap / GSI implicit flow.
/// 2. <c>Code</c> + <c>RedirectUri</c> – authorization code exchanged server-side
///    via Google's token endpoint (standard OAuth 2.0 PKCE / code flow).
/// </summary>
public sealed record GoogleLoginRequest(
    string? IdToken,
    string? Code,
    string? RedirectUri);

public sealed record AppleLoginRequest(
    string IdentityToken,
    string? FullName);

public sealed record UserProfileResponse(
    Guid Id,
    string Email,
    string FullName,
    string? AvatarUrl,
    bool EmailVerified,
    IReadOnlyList<string> Providers);

public sealed record AuthTokenResponse(
    string AccessToken,
    string TokenType,
    int ExpiresIn,
    UserProfileResponse User);

public sealed class AuthRuleException(string code, string message) : Exception(message)
{
    public string Code => code;
}
