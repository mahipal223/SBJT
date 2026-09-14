namespace ServiceDesk.Application.Financials;

public sealed record FinancialLineRecord(
    Guid Id,
    string ItemType,
    string Description,
    decimal Quantity,
    string Unit,
    decimal UnitPrice,
    decimal DiscountAmount,
    decimal TaxAmount,
    int SortOrder,
    decimal LineTotal);

public sealed record EstimateRecord(
    Guid Id,
    Guid BusinessId,
    Guid JobId,
    string EstimateNumber,
    int Revision,
    string Status,
    DateOnly ValidUntil,
    string CustomerName,
    decimal Subtotal,
    decimal DiscountTotal,
    decimal TaxTotal,
    decimal Total,
    DateTimeOffset? SentAt,
    DateTimeOffset CreatedAt,
    IReadOnlyList<FinancialLineRecord> Items);

public sealed record CreateEstimateCommand(DateOnly ValidUntil);

public sealed record ReviseEstimateCommand(DateOnly ValidUntil);

public sealed record PublicEstimateLinkRecord(
    string Token,
    DateTimeOffset ExpiresAt);

public sealed record PublicEstimateRecord(
    Guid EstimateId,
    string BusinessName,
    string CustomerName,
    string EstimateNumber,
    int Revision,
    string Status,
    DateOnly ValidUntil,
    decimal Subtotal,
    decimal DiscountTotal,
    decimal TaxTotal,
    decimal Total,
    string? Decision,
    DateTimeOffset? DecidedAt,
    IReadOnlyList<FinancialLineRecord> Items);

public sealed record EstimateDecisionCommand(
    string Decision,
    string ApproverName,
    string ApproverEmail);

public sealed record EstimateDecisionRecord(
    Guid Id,
    Guid EstimateId,
    string Decision,
    string ApproverName,
    string ApproverEmail,
    DateTimeOffset DecidedAt);

public sealed record InvoiceRecord(
    Guid Id,
    Guid BusinessId,
    Guid JobId,
    Guid CustomerId,
    string InvoiceNumber,
    string CustomerName,
    string Status,
    string DeliveryStatus,
    DateOnly? IssuedOn,
    DateOnly? DueOn,
    decimal Subtotal,
    decimal DiscountTotal,
    decimal TaxTotal,
    decimal Total,
    decimal Balance,
    string PaymentStatus,
    bool IsOverdue,
    DateTimeOffset CreatedAt,
    IReadOnlyList<FinancialLineRecord> Items);

public sealed record IssueInvoiceCommand(DateOnly IssuedOn, DateOnly DueOn);

public sealed record RecordPaymentCommand(
    decimal Amount,
    string Method,
    string? ExternalReference,
    DateTimeOffset? PaidAt);

public sealed record PaymentRecord(
    Guid Id,
    Guid InvoiceId,
    decimal Amount,
    string Method,
    string Status,
    string? ExternalReference,
    DateTimeOffset PaidAt);

public interface IFinancialService
{
    Task<IReadOnlyList<EstimateRecord>> ListEstimatesAsync(Guid businessId, string? status, CancellationToken cancellationToken = default);
    Task<EstimateRecord> GetEstimateAsync(Guid businessId, Guid estimateId, CancellationToken cancellationToken = default);
    Task<EstimateRecord> CreateEstimateAsync(Guid businessId, Guid jobId, CreateEstimateCommand command, CancellationToken cancellationToken = default);
    Task<EstimateRecord> SendEstimateAsync(Guid businessId, Guid estimateId, CancellationToken cancellationToken = default);
    Task<EstimateRecord> ReviseEstimateAsync(Guid businessId, Guid estimateId, ReviseEstimateCommand command, CancellationToken cancellationToken = default);
    Task<PublicEstimateLinkRecord> CreatePublicEstimateLinkAsync(Guid businessId, Guid estimateId, CancellationToken cancellationToken = default);
    Task<PublicEstimateRecord> GetPublicEstimateAsync(string token, CancellationToken cancellationToken = default);
    Task<EstimateDecisionRecord> DecidePublicEstimateAsync(string token, EstimateDecisionCommand command, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<InvoiceRecord>> ListInvoicesAsync(Guid businessId, string? status, CancellationToken cancellationToken = default);
    Task<InvoiceRecord> GetInvoiceAsync(Guid businessId, Guid invoiceId, CancellationToken cancellationToken = default);
    Task<InvoiceRecord> CreateInvoiceAsync(Guid businessId, Guid jobId, CancellationToken cancellationToken = default);
    Task<InvoiceRecord> IssueInvoiceAsync(Guid businessId, Guid invoiceId, IssueInvoiceCommand command, CancellationToken cancellationToken = default);
    Task<PaymentRecord> RecordPaymentAsync(Guid businessId, Guid invoiceId, RecordPaymentCommand command, CancellationToken cancellationToken = default);
    Task<PdfDocumentResult> GetEstimatePdfAsync(Guid businessId, Guid estimateId, CancellationToken cancellationToken = default);
    Task<PdfDocumentResult> GetInvoicePdfAsync(Guid businessId, Guid invoiceId, CancellationToken cancellationToken = default);
    Task<SmtpSettingsRecord> GetSmtpSettingsAsync(Guid businessId, CancellationToken cancellationToken = default);
    Task<SmtpSettingsRecord> SaveSmtpSettingsAsync(Guid businessId, SaveSmtpSettingsCommand command, CancellationToken cancellationToken = default);
    Task<TestSmtpConnectionResult> TestSmtpSettingsAsync(Guid businessId, TestSmtpConnectionCommand command, CancellationToken cancellationToken = default);
}

public sealed record PdfDocumentResult(
    byte[] Content,
    string FileName,
    string ContentType = "application/pdf");

public sealed record SmtpSettingsRecord(
    string Host,
    int Port,
    string Username,
    string? MaskedPassword,
    string FromEmail,
    string FromName,
    bool EnableSsl,
    bool IsEnabled);

public sealed record SaveSmtpSettingsCommand(
    string Host,
    int Port,
    string Username,
    string? Password,
    string FromEmail,
    string FromName,
    bool EnableSsl,
    bool IsEnabled);

public sealed record TestSmtpConnectionCommand(
    string TargetEmail);

public sealed record TestSmtpConnectionResult(
    bool Success,
    string Message);

public sealed class FinancialRuleException(string code, string message) : Exception(message)
{
    public string Code { get; } = code;
}
