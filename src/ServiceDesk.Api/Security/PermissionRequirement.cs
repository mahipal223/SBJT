using Microsoft.AspNetCore.Authorization;

namespace ServiceDesk.Api.Security;

public sealed record PermissionRequirement(string Permission) : IAuthorizationRequirement;
