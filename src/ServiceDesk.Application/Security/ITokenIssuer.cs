namespace ServiceDesk.Application.Security;

public interface ITokenIssuer
{
    (string Token, int ExpiresIn) IssueToken(Guid userId, string email, string fullName);
}
