using System.Data;
using System.Text;
using Microsoft.Data.SqlClient;
using ServiceDesk.Application.Abstractions;
using ServiceDesk.Application.DataControls;
using ServiceDesk.Infrastructure.Data;

namespace ServiceDesk.Infrastructure.Services;

public sealed class DataExportService(
    BaseDAL baseDAL,
    IAuditService auditService,
    ITenantContextAccessor tenantContext) : IDataExportService
{
    private static readonly string StorageBasePath = Path.Combine(AppContext.BaseDirectory, "Storage", "Exports");

    public async Task<ExportRequestResponse> CreateExportAsync(
        Guid businessId,
        Guid requestedByMemberId,
        CreateExportRequest request,
        CancellationToken cancellationToken = default)
    {
        var rawType = request.ExportType?.Trim() ?? "FullBusiness";
        var exportType = rawType switch
        {
            "Customers" => "Customers",
            "Jobs" => "Jobs",
            "Invoices" => "Invoices",
            _ => "FullBusiness"
        };

        var exportId = Guid.NewGuid();
        var csvContent = await GenerateCsvAsync(businessId, exportType, cancellationToken).ConfigureAwait(false);
        var bytes = Encoding.UTF8.GetBytes(csvContent);

        var tenantDir = Path.Combine(StorageBasePath, businessId.ToString());
        Directory.CreateDirectory(tenantDir);
        var filePath = Path.Combine(tenantDir, $"{exportId}.csv");
        await File.WriteAllBytesAsync(filePath, bytes, cancellationToken).ConfigureAwait(false);

        var expiresAt = DateTimeOffset.UtcNow.AddDays(7);

        const string sql = """
            INSERT INTO app.ExportRequests
                (BusinessId, Id, RequestedByMemberId, ExportType, Status, Filters, StorageKey, ExpiresAt, CreatedAt, UpdatedAt)
            VALUES
                (@BusinessId, @Id, @RequestedByMemberId, @ExportType, 'Ready', NULL, @StorageKey, @ExpiresAt, SYSUTCDATETIME(), SYSUTCDATETIME());
            """;

        await baseDAL.ExecuteNonQueryAsync(
            businessId,
            "ExportRequests.Create",
            sql,
            [
                UniqueIdentifier("@BusinessId", businessId),
                UniqueIdentifier("@Id", exportId),
                UniqueIdentifier("@RequestedByMemberId", requestedByMemberId),
                VarChar("@ExportType", exportType, 32),
                NVarChar("@StorageKey", filePath, 450),
                DateTime2("@ExpiresAt", expiresAt.UtcDateTime)
            ],
            cancellationToken).ConfigureAwait(false);

        var currentActor = tenantContext.Current;
        await auditService.RecordAuditEventAsync(
            businessId,
            currentActor?.UserId,
            "export.created",
            "ExportRequest",
            exportId,
            $"{{\"exportType\":\"{exportType}\",\"sizeBytes\":{bytes.Length}}}",
            cancellationToken).ConfigureAwait(false);

        return new ExportRequestResponse(
            exportId,
            businessId,
            requestedByMemberId,
            exportType,
            "Ready",
            filePath,
            DateTimeOffset.UtcNow,
            expiresAt);
    }

    public Task<IReadOnlyList<ExportRequestResponse>> ListExportsAsync(
        Guid businessId,
        CancellationToken cancellationToken = default)
    {
        const string sql = """
            SELECT TOP 50
                Id,
                BusinessId,
                RequestedByMemberId,
                ExportType,
                Status,
                StorageKey,
                CreatedAt,
                ExpiresAt
            FROM app.ExportRequests
            WHERE BusinessId = @BusinessId
            ORDER BY CreatedAt DESC;
            """;

        return baseDAL.ExecuteQueryAsync(
            businessId,
            "ExportRequests.List",
            sql,
            reader => new ExportRequestResponse(
                reader.GetGuid(0),
                reader.GetGuid(1),
                reader.GetGuid(2),
                reader.GetString(3),
                reader.GetString(4),
                reader.IsDBNull(5) ? null : reader.GetString(5),
                new DateTimeOffset(DateTime.SpecifyKind(reader.GetDateTime(6), DateTimeKind.Utc)),
                reader.IsDBNull(7) ? null : new DateTimeOffset(DateTime.SpecifyKind(reader.GetDateTime(7), DateTimeKind.Utc))),
            [
                UniqueIdentifier("@BusinessId", businessId)
            ],
            cancellationToken);
    }

    public async Task<ExportPackageResponse?> GetExportPackageAsync(
        Guid businessId,
        Guid exportId,
        CancellationToken cancellationToken = default)
    {
        const string sql = """
            SELECT ExportType, StorageKey, Status
            FROM app.ExportRequests
            WHERE BusinessId = @BusinessId AND Id = @Id;
            """;

        var records = await baseDAL.ExecuteQueryAsync(
            businessId,
            "ExportRequests.Get",
            sql,
            reader => new
            {
                ExportType = reader.GetString(0),
                StorageKey = reader.IsDBNull(1) ? null : reader.GetString(1),
                Status = reader.GetString(2)
            },
            [
                UniqueIdentifier("@BusinessId", businessId),
                UniqueIdentifier("@Id", exportId)
            ],
            cancellationToken).ConfigureAwait(false);

        var record = records.Count > 0 ? records[0] : null;

        if (record is null || record.Status != "Ready")
        {
            return null;
        }

        byte[] bytes;
        if (!string.IsNullOrWhiteSpace(record.StorageKey) && File.Exists(record.StorageKey))
        {
            bytes = await File.ReadAllBytesAsync(record.StorageKey, cancellationToken).ConfigureAwait(false);
        }
        else
        {
            var regenerated = await GenerateCsvAsync(businessId, record.ExportType, cancellationToken).ConfigureAwait(false);
            bytes = Encoding.UTF8.GetBytes(regenerated);
        }

        var fileName = $"{record.ExportType.ToLowerInvariant()}-export-{exportId.ToString()[..8]}.csv";
        return new ExportPackageResponse(fileName, "text/csv; charset=utf-8", bytes);
    }

    private async Task<string> GenerateCsvAsync(Guid businessId, string exportType, CancellationToken cancellationToken)
    {
        var sb = new StringBuilder();

        if (exportType is "Customers" or "FullBusiness")
        {
            if (exportType == "FullBusiness")
            {
                sb.AppendLine("=== CUSTOMERS ===");
            }
            sb.AppendLine("Id,Name,Email,Phone,CreatedAt");

            const string customerSql = """
                SELECT Id, Name, Email, Phone, CreatedAt
                FROM app.Customers
                WHERE BusinessId = @BusinessId AND ArchivedAt IS NULL
                ORDER BY CreatedAt DESC;
                """;

            var customers = await baseDAL.ExecuteQueryAsync(
                businessId,
                "Export.Customers",
                customerSql,
                reader => new
                {
                    Id = reader.GetGuid(0),
                    Name = reader.GetString(1),
                    Email = reader.IsDBNull(2) ? "" : reader.GetString(2),
                    Phone = reader.IsDBNull(3) ? "" : reader.GetString(3),
                    CreatedAt = reader.GetDateTime(4).ToString("O", System.Globalization.CultureInfo.InvariantCulture)
                },
                [UniqueIdentifier("@BusinessId", businessId)],
                cancellationToken).ConfigureAwait(false);

            foreach (var c in customers)
            {
                sb.AppendLine(System.Globalization.CultureInfo.InvariantCulture, $"{c.Id},{Escape(c.Name)},{Escape(c.Email)},{Escape(c.Phone)},{c.CreatedAt}");
            }

            if (exportType == "FullBusiness")
            {
                sb.AppendLine();
            }
        }

        if (exportType is "Jobs" or "FullBusiness")
        {
            if (exportType == "FullBusiness")
            {
                sb.AppendLine("=== JOBS ===");
            }
            sb.AppendLine("Id,JobNumber,Title,CustomerName,Status,Priority,CreatedAt");

            const string jobSql = """
                SELECT j.Id, j.JobNumber, j.Title, c.Name, j.Status, j.Priority, j.CreatedAt
                FROM app.Jobs AS j
                INNER JOIN app.Customers AS c ON c.BusinessId = j.BusinessId AND c.Id = j.CustomerId
                WHERE j.BusinessId = @BusinessId
                ORDER BY j.CreatedAt DESC;
                """;

            var jobs = await baseDAL.ExecuteQueryAsync(
                businessId,
                "Export.Jobs",
                jobSql,
                reader => new
                {
                    Id = reader.GetGuid(0),
                    JobNumber = reader.GetString(1),
                    Title = reader.GetString(2),
                    CustomerName = reader.GetString(3),
                    Status = reader.GetString(4),
                    Priority = reader.GetString(5),
                    CreatedAt = reader.GetDateTime(6).ToString("O", System.Globalization.CultureInfo.InvariantCulture)
                },
                [UniqueIdentifier("@BusinessId", businessId)],
                cancellationToken).ConfigureAwait(false);

            foreach (var j in jobs)
            {
                sb.AppendLine(System.Globalization.CultureInfo.InvariantCulture, $"{j.Id},{Escape(j.JobNumber)},{Escape(j.Title)},{Escape(j.CustomerName)},{Escape(j.Status)},{Escape(j.Priority)},{j.CreatedAt}");
            }

            if (exportType == "FullBusiness")
            {
                sb.AppendLine();
            }
        }

        if (exportType is "Invoices" or "FullBusiness")
        {
            if (exportType == "FullBusiness")
            {
                sb.AppendLine("=== INVOICES ===");
            }
            sb.AppendLine("Id,InvoiceNumber,CustomerName,Status,IssuedOn,DueOn,Subtotal,TaxTotal,Total");

            const string invoiceSql = """
                SELECT i.Id, i.InvoiceNumber, c.Name, i.Status, i.IssuedOn, i.DueOn, i.Subtotal, i.TaxTotal, i.Total
                FROM app.Invoices AS i
                INNER JOIN app.Customers AS c ON c.BusinessId = i.BusinessId AND c.Id = i.CustomerId
                WHERE i.BusinessId = @BusinessId
                ORDER BY i.CreatedAt DESC;
                """;

            var invoices = await baseDAL.ExecuteQueryAsync(
                businessId,
                "Export.Invoices",
                invoiceSql,
                reader => new
                {
                    Id = reader.GetGuid(0),
                    InvoiceNumber = reader.GetString(1),
                    CustomerName = reader.GetString(2),
                    Status = reader.GetString(3),
                    IssuedOn = DateOnly.FromDateTime(reader.GetDateTime(4)).ToString("yyyy-MM-dd", System.Globalization.CultureInfo.InvariantCulture),
                    DueOn = DateOnly.FromDateTime(reader.GetDateTime(5)).ToString("yyyy-MM-dd", System.Globalization.CultureInfo.InvariantCulture),
                    Subtotal = reader.GetDecimal(6),
                    TaxTotal = reader.GetDecimal(7),
                    Total = reader.GetDecimal(8)
                },
                [UniqueIdentifier("@BusinessId", businessId)],
                cancellationToken).ConfigureAwait(false);

            foreach (var inv in invoices)
            {
                sb.AppendLine(System.Globalization.CultureInfo.InvariantCulture, $"{inv.Id},{Escape(inv.InvoiceNumber)},{Escape(inv.CustomerName)},{Escape(inv.Status)},{inv.IssuedOn},{inv.DueOn},{inv.Subtotal:F2},{inv.TaxTotal:F2},{inv.Total:F2}");
            }
        }

        return sb.ToString();
    }

    private static string Escape(string? value)
    {
        if (string.IsNullOrEmpty(value))
        {
            return "";
        }
        if (value.Contains(',') || value.Contains('"') || value.Contains('\n') || value.Contains('\r'))
        {
            return $"\"{value.Replace("\"", "\"\"")}\"";
        }
        return value;
    }

    private static SqlParameter UniqueIdentifier(string name, Guid value) => new(name, SqlDbType.UniqueIdentifier) { Value = value };
    private static SqlParameter VarChar(string name, string? value, int size) => new(name, SqlDbType.VarChar, size) { Value = value ?? (object)DBNull.Value };
    private static SqlParameter NVarChar(string name, string? value, int size) => new(name, SqlDbType.NVarChar, size) { Value = value ?? (object)DBNull.Value };
    private static SqlParameter DateTime2(string name, DateTime value) => new(name, SqlDbType.DateTime2) { Value = value, Scale = 3 };
}
