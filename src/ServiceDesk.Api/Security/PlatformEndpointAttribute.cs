namespace ServiceDesk.Api.Security;

/// <summary>
/// Marks an endpoint or controller as belonging to the Platform Admin control plane.
/// Requests to these endpoints bypass tenant membership resolution.
/// </summary>
[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method, Inherited = true, AllowMultiple = false)]
public sealed class PlatformEndpointAttribute : Attribute;
