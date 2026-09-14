using ServiceDesk.Application.Security;

namespace ServiceDesk.Application.Abstractions;

public interface ITenantContextAccessor
{
    TenantContext? Current { get; }
}
