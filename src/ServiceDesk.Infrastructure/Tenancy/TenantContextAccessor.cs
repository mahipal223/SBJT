using ServiceDesk.Application.Abstractions;
using ServiceDesk.Application.Security;

namespace ServiceDesk.Infrastructure.Tenancy;

public sealed class TenantContextAccessor : ITenantContextAccessor
{
    public TenantContext? Current { get; private set; }

    public void Set(TenantContext context)
    {
        ArgumentNullException.ThrowIfNull(context);
        Current = context;
    }

    public void Clear() => Current = null;
}
