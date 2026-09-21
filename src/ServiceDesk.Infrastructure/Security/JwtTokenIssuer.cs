using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;
using ServiceDesk.Application.Security;

namespace ServiceDesk.Infrastructure.Security;

public sealed class JwtTokenIssuer(IConfiguration configuration) : ITokenIssuer
{
    public (string Token, int ExpiresIn) IssueToken(Guid userId, string email, string fullName)
    {
        var secretKey = configuration["Jwt:SecretKey"]
            ?? "ServiceDeskSuperSecretSigningKeyForDevelopmentPurposesOnly_MustBeAtLeast32BytesLong!";
        var issuer = configuration["Jwt:Issuer"] ?? "ServiceDesk.Api";
        var audience = configuration["Jwt:Audience"] ?? "ServiceDesk.Client";
        var expiryHours = int.TryParse(configuration["Jwt:ExpiryHours"], out var hours) ? hours : 24;

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secretKey));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var expires = DateTime.UtcNow.AddHours(expiryHours);
        var expiresInSeconds = (int)(expires - DateTime.UtcNow).TotalSeconds;

        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, userId.ToString()),
            new Claim("sub", userId.ToString()),
            new Claim(ClaimTypes.Email, email),
            new Claim(ClaimTypes.Name, fullName),
            new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString())
        };

        var token = new JwtSecurityToken(
            issuer: issuer,
            audience: audience,
            claims: claims,
            notBefore: DateTime.UtcNow,
            expires: expires,
            signingCredentials: creds);

        var tokenString = new JwtSecurityTokenHandler().WriteToken(token);
        return (tokenString, expiresInSeconds);
    }
}
