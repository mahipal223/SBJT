using System.Data;
using Microsoft.Data.SqlClient;
using ServiceDesk.Application.Reports;
using ServiceDesk.Infrastructure.Data;

namespace ServiceDesk.Infrastructure.Services;

public sealed class ReportService(BaseDAL baseDAL) : IReportService
{
    public async Task<DashboardSummaryResponse> GetDashboardSummaryAsync(
        Guid businessId,
        CancellationToken cancellationToken = default)
    {
        var nowUtc = DateTime.UtcNow;
        var todayStart = nowUtc.Date;
        var tomorrowStart = todayStart.AddDays(1);
        var thisMonthStart = new DateTime(nowUtc.Year, nowUtc.Month, 1, 0, 0, 0, DateTimeKind.Utc);
        var nextMonthStart = thisMonthStart.AddMonths(1);
        var lastMonthStart = thisMonthStart.AddMonths(-1);

        const string kpiSql = """
            -- Today Jobs
            SELECT
                COUNT(1) AS TotalJobsToday,
                ISNULL(SUM(CASE WHEN j.Status = 'Completed' THEN 1 ELSE 0 END), 0) AS CompletedJobsToday
            FROM app.Jobs AS j
            WHERE j.BusinessId = @BusinessId
              AND (
                  j.CreatedAt >= @TodayStart
                  OR EXISTS (
                      SELECT 1 FROM app.Appointments AS a
                      WHERE a.BusinessId = j.BusinessId AND a.JobId = j.Id
                        AND a.StartsAt >= @TodayStart AND a.StartsAt < @TomorrowStart
                  )
              );

            -- Open Estimates
            SELECT
                COUNT(1) AS OpenEstimatesCount,
                ISNULL(SUM(e.Total), 0) AS OpenEstimatesValue
            FROM app.Estimates AS e
            WHERE e.BusinessId = @BusinessId
              AND e.Status IN ('Draft', 'Sent');

            -- Outstanding Invoices
            SELECT
                COUNT(1) AS OutstandingInvoicesCount,
                ISNULL(SUM(i.Total - ISNULL(p.PaidTotal, 0)), 0) AS OutstandingInvoicesValue
            FROM app.Invoices AS i
            OUTER APPLY (
                SELECT SUM(py.Amount) AS PaidTotal
                FROM app.Payments AS py
                WHERE py.BusinessId = i.BusinessId AND py.InvoiceId = i.Id AND py.Status = 'Succeeded'
            ) AS p
            WHERE i.BusinessId = @BusinessId
              AND i.Status IN ('Issued', 'PartiallyPaid');

            -- Revenue This & Last Month
            SELECT
                ISNULL(SUM(CASE WHEN py.PaidAt >= @ThisMonthStart AND py.PaidAt < @NextMonthStart THEN py.Amount ELSE 0 END), 0) AS RevenueThisMonth,
                ISNULL(SUM(CASE WHEN py.PaidAt >= @LastMonthStart AND py.PaidAt < @ThisMonthStart THEN py.Amount ELSE 0 END), 0) AS RevenueLastMonth
            FROM app.Payments AS py
            WHERE py.BusinessId = @BusinessId
              AND py.Status = 'Succeeded';
            """;

        int jobsToday = 0;
        int jobsCompletedToday = 0;
        int openEstimates = 0;
        decimal openEstimatesVal = 0m;
        int outstandingInvoices = 0;
        decimal outstandingInvoicesVal = 0m;
        decimal revThisMonth = 0m;
        decimal revLastMonth = 0m;

        await using (var connection = await baseDAL.OpenConnectionAsync(businessId, cancellationToken).ConfigureAwait(false))
        await using (var cmd = BaseDAL.BuildCommand(
            connection,
            null,
            kpiSql,
            parameters:
            [
                UniqueIdentifier("@BusinessId", businessId),
                DateTime2("@TodayStart", todayStart),
                DateTime2("@TomorrowStart", tomorrowStart),
                DateTime2("@ThisMonthStart", thisMonthStart),
                DateTime2("@NextMonthStart", nextMonthStart),
                DateTime2("@LastMonthStart", lastMonthStart)
            ]))
        await using (var reader = await cmd.ExecuteReaderAsync(cancellationToken).ConfigureAwait(false))
        {
            // Table 1: Today Jobs
            if (await reader.ReadAsync(cancellationToken).ConfigureAwait(false))
            {
                jobsToday = reader.GetInt32(0);
                jobsCompletedToday = reader.GetInt32(1);
            }

            // Table 2: Estimates
            if (await reader.NextResultAsync(cancellationToken).ConfigureAwait(false) && await reader.ReadAsync(cancellationToken).ConfigureAwait(false))
            {
                openEstimates = reader.GetInt32(0);
                openEstimatesVal = reader.GetDecimal(1);
            }

            // Table 3: Invoices
            if (await reader.NextResultAsync(cancellationToken).ConfigureAwait(false) && await reader.ReadAsync(cancellationToken).ConfigureAwait(false))
            {
                outstandingInvoices = reader.GetInt32(0);
                outstandingInvoicesVal = reader.GetDecimal(1);
            }

            // Table 4: Revenue
            if (await reader.NextResultAsync(cancellationToken).ConfigureAwait(false) && await reader.ReadAsync(cancellationToken).ConfigureAwait(false))
            {
                revThisMonth = reader.GetDecimal(0);
                revLastMonth = reader.GetDecimal(1);
            }
        }

        // Fetch Today's schedule / active jobs
        const string scheduleSql = """
            SELECT TOP 10
                j.Id,
                j.JobNumber,
                j.Title,
                c.Name AS CustomerName,
                j.Status,
                j.Priority,
                a.StartsAt AS ScheduledStartAt,
                m.RoleCode AS AssignedMemberName
            FROM app.Jobs AS j
            INNER JOIN app.Customers AS c ON c.BusinessId = j.BusinessId AND c.Id = j.CustomerId
            LEFT JOIN app.Appointments AS a ON a.BusinessId = j.BusinessId AND a.JobId = j.Id
            LEFT JOIN app.JobAssignments AS ja ON ja.BusinessId = j.BusinessId AND ja.JobId = j.Id
            LEFT JOIN app.Members AS m ON m.BusinessId = ja.BusinessId AND m.Id = ja.MemberId
            WHERE j.BusinessId = @BusinessId
              AND j.Status NOT IN ('Cancelled')
            ORDER BY
                CASE WHEN j.Status = 'InProgress' THEN 1 WHEN j.Status = 'Scheduled' THEN 2 ELSE 3 END,
                j.CreatedAt DESC;
            """;

        var schedule = await baseDAL.ExecuteQueryAsync(
            businessId,
            "Dashboard.Schedule",
            scheduleSql,
            reader => new TodayJobItem(
                reader.GetGuid(0),
                reader.GetString(1),
                reader.GetString(2),
                reader.GetString(3),
                reader.GetString(4),
                reader.GetString(5),
                reader.IsDBNull(6) ? null : new DateTimeOffset(DateTime.SpecifyKind(reader.GetDateTime(6), DateTimeKind.Utc)),
                reader.IsDBNull(7) ? null : reader.GetString(7)),
            [UniqueIdentifier("@BusinessId", businessId)],
            cancellationToken).ConfigureAwait(false);

        // Fetch Attention Items: Overdue invoices
        const string overdueSql = """
            SELECT TOP 5
                i.Id,
                i.InvoiceNumber,
                c.Name AS CustomerName,
                i.DueOn,
                (i.Total - ISNULL(p.PaidTotal, 0)) AS BalanceDue
            FROM app.Invoices AS i
            INNER JOIN app.Customers AS c ON c.BusinessId = i.BusinessId AND c.Id = i.CustomerId
            OUTER APPLY (
                SELECT SUM(py.Amount) AS PaidTotal
                FROM app.Payments AS py
                WHERE py.BusinessId = i.BusinessId AND py.InvoiceId = i.Id AND py.Status = 'Succeeded'
            ) AS p
            WHERE i.BusinessId = @BusinessId
              AND i.Status IN ('Issued', 'PartiallyPaid')
              AND i.DueOn < @TodayDate;
            """;

        var overdueInvoices = await baseDAL.ExecuteQueryAsync(
            businessId,
            "Dashboard.OverdueInvoices",
            overdueSql,
            reader => new
            {
                Id = reader.GetGuid(0),
                Number = reader.GetString(1),
                Customer = reader.GetString(2),
                DueOn = DateOnly.FromDateTime(reader.GetDateTime(3)),
                Balance = reader.GetDecimal(4)
            },
            [
                UniqueIdentifier("@BusinessId", businessId),
                Date("@TodayDate", DateOnly.FromDateTime(todayStart))
            ],
            cancellationToken).ConfigureAwait(false);

        var attentionItems = new List<NeedsAttentionItem>();
        foreach (var inv in overdueInvoices)
        {
            attentionItems.Add(new NeedsAttentionItem(
                "OverdueInvoice",
                "High",
                $"Invoice {inv.Number} is overdue",
                $"{inv.Customer} has an outstanding balance of ${inv.Balance:F2} due on {inv.DueOn:yyyy-MM-dd}.",
                $"/app/invoices/{inv.Id}"));
        }

        var jobsRemaining = Math.Max(0, jobsToday - jobsCompletedToday);

        return new DashboardSummaryResponse(
            jobsToday,
            jobsCompletedToday,
            jobsRemaining,
            openEstimates,
            openEstimatesVal,
            outstandingInvoices,
            outstandingInvoicesVal,
            revThisMonth,
            revLastMonth,
            schedule,
            attentionItems);
    }

    public async Task<BusinessReportResponse> GetBusinessReportAsync(
        Guid businessId,
        DateOnly? fromDate,
        DateOnly? toDate,
        CancellationToken cancellationToken = default)
    {
        var end = toDate ?? DateOnly.FromDateTime(DateTime.UtcNow);
        var start = fromDate ?? end.AddDays(-30);
        if (start > end)
        {
            (start, end) = (end, start);
        }

        var periodStartUtc = start.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
        var periodEndUtc = end.AddDays(1).ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
        var durationDays = (periodEndUtc - periodStartUtc).TotalDays;
        var prevStartUtc = periodStartUtc.AddDays(-durationDays);
        var prevEndUtc = periodStartUtc;

        // Financial KPIs for period
        const string summarySql = """
            -- Current Period Revenue
            SELECT ISNULL(SUM(Amount), 0) FROM app.Payments
            WHERE BusinessId = @BusinessId AND Status = 'Succeeded' AND PaidAt >= @PeriodStart AND PaidAt < @PeriodEnd;

            -- Previous Period Revenue
            SELECT ISNULL(SUM(Amount), 0) FROM app.Payments
            WHERE BusinessId = @BusinessId AND Status = 'Succeeded' AND PaidAt >= @PrevStart AND PaidAt < @PrevEnd;

            -- Completed Jobs
            SELECT COUNT(1) FROM app.Jobs
            WHERE BusinessId = @BusinessId AND Status = 'Completed' AND UpdatedAt >= @PeriodStart AND UpdatedAt < @PeriodEnd;

            -- Average Job (Invoice Total)
            SELECT ISNULL(AVG(Total), 0) FROM app.Invoices
            WHERE BusinessId = @BusinessId AND IssuedOn >= @StartDate AND IssuedOn <= @EndDate;

            -- New Customers
            SELECT COUNT(1) FROM app.Customers
            WHERE BusinessId = @BusinessId AND CreatedAt >= @PeriodStart AND CreatedAt < @PeriodEnd;
            """;

        decimal totalRevenue = 0m;
        decimal prevRevenue = 0m;
        int jobsCompleted = 0;
        decimal avgJobValue = 0m;
        int newCustomers = 0;

        await using (var connection = await baseDAL.OpenConnectionAsync(businessId, cancellationToken).ConfigureAwait(false))
        await using (var cmd = BaseDAL.BuildCommand(
            connection,
            null,
            summarySql,
            parameters:
            [
                UniqueIdentifier("@BusinessId", businessId),
                DateTime2("@PeriodStart", periodStartUtc),
                DateTime2("@PeriodEnd", periodEndUtc),
                DateTime2("@PrevStart", prevStartUtc),
                DateTime2("@PrevEnd", prevEndUtc),
                Date("@StartDate", start),
                Date("@EndDate", end)
            ]))
        await using (var reader = await cmd.ExecuteReaderAsync(cancellationToken).ConfigureAwait(false))
        {
            if (await reader.ReadAsync(cancellationToken).ConfigureAwait(false))
            {
                totalRevenue = reader.GetDecimal(0);
            }
            if (await reader.NextResultAsync(cancellationToken).ConfigureAwait(false) && await reader.ReadAsync(cancellationToken).ConfigureAwait(false))
            {
                prevRevenue = reader.GetDecimal(0);
            }
            if (await reader.NextResultAsync(cancellationToken).ConfigureAwait(false) && await reader.ReadAsync(cancellationToken).ConfigureAwait(false))
            {
                jobsCompleted = reader.GetInt32(0);
            }
            if (await reader.NextResultAsync(cancellationToken).ConfigureAwait(false) && await reader.ReadAsync(cancellationToken).ConfigureAwait(false))
            {
                avgJobValue = reader.GetDecimal(0);
            }
            if (await reader.NextResultAsync(cancellationToken).ConfigureAwait(false) && await reader.ReadAsync(cancellationToken).ConfigureAwait(false))
            {
                newCustomers = reader.GetInt32(0);
            }
        }

        decimal growthPercent = prevRevenue > 0
            ? Math.Round(((totalRevenue - prevRevenue) / prevRevenue) * 100m, 1)
            : totalRevenue > 0 ? 100m : 0m;

        // Monthly Trends: Last 6 months
        const string trendSql = """
            SELECT
                FORMAT(py.PaidAt, 'yyyy-MM') AS MonthKey,
                FORMAT(py.PaidAt, 'MMM yyyy') AS MonthLabel,
                SUM(py.Amount) AS Revenue,
                COUNT(DISTINCT py.InvoiceId) AS JobsCount
            FROM app.Payments AS py
            WHERE py.BusinessId = @BusinessId
              AND py.Status = 'Succeeded'
              AND py.PaidAt >= DATEADD(month, -6, SYSUTCDATETIME())
            GROUP BY FORMAT(py.PaidAt, 'yyyy-MM'), FORMAT(py.PaidAt, 'MMM yyyy')
            ORDER BY MonthKey ASC;
            """;

        var trends = await baseDAL.ExecuteQueryAsync(
            businessId,
            "Reports.Trends",
            trendSql,
            reader => new MonthlyTrendItem(
                reader.GetString(1),
                reader.GetDecimal(2),
                reader.GetInt32(3)),
            [UniqueIdentifier("@BusinessId", businessId)],
            cancellationToken).ConfigureAwait(false);

        // Category Breakdown
        const string categorySql = """
            SELECT TOP 6
                ISNULL(NULLIF(ii.ItemType, ''), 'General Services') AS CategoryName,
                SUM(ii.LineTotal) AS TotalRevenue,
                COUNT(1) AS ItemCount
            FROM app.InvoiceItems AS ii
            INNER JOIN app.Invoices AS i ON i.BusinessId = ii.BusinessId AND i.Id = ii.InvoiceId
            WHERE ii.BusinessId = @BusinessId
            GROUP BY ISNULL(NULLIF(ii.ItemType, ''), 'General Services')
            ORDER BY TotalRevenue DESC;
            """;

        var rawCategories = await baseDAL.ExecuteQueryAsync(
            businessId,
            "Reports.Categories",
            categorySql,
            reader => new
            {
                Name = reader.GetString(0),
                Total = reader.GetDecimal(1),
                Count = reader.GetInt32(2)
            },
            [UniqueIdentifier("@BusinessId", businessId)],
            cancellationToken).ConfigureAwait(false);

        var catTotalSum = rawCategories.Sum(c => c.Total);
        var categories = rawCategories.Select(c => new CategoryBreakdownItem(
            c.Name,
            c.Total,
            catTotalSum > 0 ? Math.Round((c.Total / catTotalSum) * 100m, 1) : 0m,
            c.Count)).ToList();

        // Technician Performance
        const string techSql = """
            SELECT TOP 10
                ISNULL(m.RoleCode, 'Staff') AS MemberName,
                COUNT(DISTINCT CASE WHEN j.Status = 'Completed' THEN j.Id END) AS JobsCompleted,
                ISNULL(SUM(CASE WHEN j.Status = 'Completed' THEN i.Total ELSE 0 END), 0) AS TotalRevenue
            FROM app.Members AS m
            INNER JOIN app.JobAssignments AS ja ON ja.BusinessId = m.BusinessId AND ja.MemberId = m.Id
            INNER JOIN app.Jobs AS j ON j.BusinessId = ja.BusinessId AND j.Id = ja.JobId
            LEFT JOIN app.Invoices AS i ON i.BusinessId = j.BusinessId AND i.JobId = j.Id
            WHERE m.BusinessId = @BusinessId
            GROUP BY ISNULL(m.RoleCode, 'Staff')
            ORDER BY TotalRevenue DESC, JobsCompleted DESC;
            """;

        var technicians = await baseDAL.ExecuteQueryAsync(
            businessId,
            "Reports.Technicians",
            techSql,
            reader => new TechnicianPerformanceItem(
                reader.GetString(0),
                reader.GetInt32(1),
                reader.GetDecimal(2)),
            [UniqueIdentifier("@BusinessId", businessId)],
            cancellationToken).ConfigureAwait(false);

        // Invoice Aging
        const string agingSql = """
            SELECT
                ISNULL(SUM(CASE WHEN i.DueOn >= @TodayDate THEN (i.Total - ISNULL(p.PaidTotal, 0)) ELSE 0 END), 0) AS CurrentDue,
                ISNULL(SUM(CASE WHEN DATEDIFF(day, i.DueOn, @TodayDate) BETWEEN 1 AND 30 THEN (i.Total - ISNULL(p.PaidTotal, 0)) ELSE 0 END), 0) AS Days1To30,
                ISNULL(SUM(CASE WHEN DATEDIFF(day, i.DueOn, @TodayDate) BETWEEN 31 AND 60 THEN (i.Total - ISNULL(p.PaidTotal, 0)) ELSE 0 END), 0) AS Days31To60,
                ISNULL(SUM(CASE WHEN DATEDIFF(day, i.DueOn, @TodayDate) > 60 THEN (i.Total - ISNULL(p.PaidTotal, 0)) ELSE 0 END), 0) AS Days60Plus
            FROM app.Invoices AS i
            OUTER APPLY (
                SELECT SUM(py.Amount) AS PaidTotal
                FROM app.Payments AS py
                WHERE py.BusinessId = i.BusinessId AND py.InvoiceId = i.Id AND py.Status = 'Succeeded'
            ) AS p
            WHERE i.BusinessId = @BusinessId
              AND i.Status IN ('Issued', 'PartiallyPaid');
            """;

        var todayDateOnly = DateOnly.FromDateTime(DateTime.UtcNow);
        var agingRows = await baseDAL.ExecuteQueryAsync(
            businessId,
            "Reports.Aging",
            agingSql,
            reader => new InvoiceAgingSummary(
                reader.GetDecimal(0),
                reader.GetDecimal(1),
                reader.GetDecimal(2),
                reader.GetDecimal(3)),
            [
                UniqueIdentifier("@BusinessId", businessId),
                Date("@TodayDate", todayDateOnly)
            ],
            cancellationToken).ConfigureAwait(false);
        var aging = agingRows.Count > 0 ? agingRows[0] : new InvoiceAgingSummary(0, 0, 0, 0);

        return new BusinessReportResponse(
            start,
            end,
            totalRevenue,
            growthPercent,
            jobsCompleted,
            avgJobValue,
            newCustomers,
            trends,
            categories,
            technicians,
            aging);
    }

    private static SqlParameter UniqueIdentifier(string name, Guid value) => new(name, SqlDbType.UniqueIdentifier) { Value = value };
    private static SqlParameter Date(string name, DateOnly value) => new(name, SqlDbType.Date) { Value = value.ToDateTime(TimeOnly.MinValue) };
    private static SqlParameter DateTime2(string name, DateTime value) => new(name, SqlDbType.DateTime2) { Value = value, Scale = 3 };
}
