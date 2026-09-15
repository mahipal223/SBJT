namespace ServiceDesk.Api.Authentication;

public static class DevelopmentAuthenticationDefaults
{
    public const string Scheme = "DevelopmentHeader";
    public const string UserHeader = "X-Dev-User-Id";
    public const string PlatformAdminHeader = "X-Dev-Platform-Admin-Id";
}
