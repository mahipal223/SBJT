namespace ServiceDesk.Application.Security;

public interface IPasswordPolicyService
{
    Task<PasswordPolicyResponse> GetCurrentPolicyAsync(CancellationToken cancellationToken);

    Task<PasswordPolicyResponse> UpdatePolicyAsync(
        UpdatePasswordPolicyRequest request,
        Guid adminUserId,
        CancellationToken cancellationToken);

    Task ValidatePasswordAsync(string password, CancellationToken cancellationToken);
}
