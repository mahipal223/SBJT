using ServiceDesk.Application.Platform;

namespace ServiceDesk.Api.Security;

public sealed class PlatformContextAccessor : IPlatformContextAccessor
{
    public PlatformContext? Current { get; private set; }

    public void Set(PlatformContext context) => Current = context;

    public void Clear() => Current = null;
}
