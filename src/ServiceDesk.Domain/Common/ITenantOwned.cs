namespace ServiceDesk.Domain.Common;

public interface ITenantOwned
{
    Guid BusinessId { get; }
}
