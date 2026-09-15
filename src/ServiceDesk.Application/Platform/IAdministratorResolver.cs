namespace ServiceDesk.Application.Platform;

public interface IAdministratorResolver
{
    ValueTask<PlatformAdministratorRecord?> ResolveAsync(
        Guid userId,
        CancellationToken cancellationToken);
}
