namespace ServiceDesk.Application.Reports;

public sealed record TodayJobItem(
    Guid Id,
    string JobNumber,
    string Title,
    string CustomerName,
    string Status,
    string Priority,
    DateTimeOffset? ScheduledStartAt,
    string? AssignedMemberName);

public sealed record NeedsAttentionItem(
    string Type,
    string Severity,
    string Title,
    string Description,
    string? ActionUrl);

public sealed record DashboardSummaryResponse(
    int JobsTodayCount,
    int JobsCompletedTodayCount,
    int JobsRemainingTodayCount,
    int OpenEstimatesCount,
    decimal OpenEstimatesValue,
    int OutstandingInvoicesCount,
    decimal OutstandingInvoicesValue,
    decimal RevenueThisMonth,
    decimal RevenueLastMonth,
    IReadOnlyList<TodayJobItem> TodaySchedule,
    IReadOnlyList<NeedsAttentionItem> AttentionItems);

public sealed record MonthlyTrendItem(
    string MonthLabel,
    decimal Revenue,
    int JobsCount);

public sealed record CategoryBreakdownItem(
    string CategoryName,
    decimal TotalRevenue,
    decimal Percentage,
    int ItemCount);

public sealed record TechnicianPerformanceItem(
    string MemberName,
    int JobsCompleted,
    decimal TotalRevenue);

public sealed record InvoiceAgingSummary(
    decimal Current,
    decimal Days1To30,
    decimal Days31To60,
    decimal Days60Plus);

public sealed record BusinessReportResponse(
    DateOnly PeriodStart,
    DateOnly PeriodEnd,
    decimal TotalRevenue,
    decimal RevenueGrowthPercent,
    int JobsCompletedCount,
    decimal AverageJobValue,
    int NewCustomersCount,
    IReadOnlyList<MonthlyTrendItem> MonthlyTrends,
    IReadOnlyList<CategoryBreakdownItem> CategoryBreakdown,
    IReadOnlyList<TechnicianPerformanceItem> TechnicianPerformance,
    InvoiceAgingSummary InvoiceAging);

public interface IReportService
{
    Task<DashboardSummaryResponse> GetDashboardSummaryAsync(
        Guid businessId,
        CancellationToken cancellationToken);

    Task<BusinessReportResponse> GetBusinessReportAsync(
        Guid businessId,
        DateOnly? fromDate,
        DateOnly? toDate,
        CancellationToken cancellationToken);
}
