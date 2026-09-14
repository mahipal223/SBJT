namespace ServiceDesk.Infrastructure.Data;

public sealed class DataAccessException : Exception
{
    public DataAccessException(string operationName, Exception innerException)
        : base($"Database operation '{operationName}' failed.", innerException)
    {
        OperationName = operationName;
    }

    public string OperationName { get; }
}
