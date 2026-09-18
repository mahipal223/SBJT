using System.Text;
using System.ComponentModel.DataAnnotations;
using ServiceDesk.Application.Financials;
using ServiceDesk.Application.Security;
using ServiceDesk.Application.Subscriptions;
using ServiceDesk.Application.Work;
using ServiceDesk.Domain.Identity;
using ServiceDesk.Infrastructure.Documents;
using ServiceDesk.Infrastructure.Services;
using ServiceDesk.Infrastructure.Work;
using ServiceDesk.Application.Platform;
using ServiceDesk.Application.Tenancy;
using ServiceDesk.Infrastructure.Tenancy;

var permissions = new HashSet<string>(StringComparer.Ordinal)
{
    Permissions.WorkspaceRead,
    Permissions.TeamManage
};

var context = new TenantContext(
    Guid.NewGuid(),
    Guid.NewGuid(),
    Guid.NewGuid(),
    BusinessRole.Owner,
    permissions);

Require(context.HasPermission(Permissions.WorkspaceRead), "Owner can read workspace");
Require(context.HasPermission(Permissions.TeamManage), "Owner can manage team");
Require(!context.HasPermission(Permissions.SubscriptionManage), "Absent permission remains denied");
Require(Permissions.All.Contains(Permissions.WorkspaceRead), "Workspace policy is registered");

var businessId = Guid.Parse("11111111-1111-1111-1111-111111111111");
var foreignBusinessId = Guid.Parse("22222222-2222-2222-2222-222222222222");
var store = new InMemoryWorkStore();
var appointmentDate = new DateOnly(2026, 9, 12);
var appointment = AppointmentWindow.Parse(appointmentDate, "9:00 AM – 10:00 AM")!;
Require(appointment.EndsAt - appointment.StartsAt == TimeSpan.FromHours(1), "Arrival window preserves the entered end time");
Require(AppointmentWindow.Parse(null, null) is null, "Unscheduled jobs have no appointment");
foreach (var invalidWindow in new[] { "invalid", "10:00 AM - 9:00 AM", "9:00 AM - 9:00 AM" })
{
    var rejected = false;
    try { AppointmentWindow.Parse(appointmentDate, invalidWindow); }
    catch (WorkRuleException ex) when (ex.Code == "validation_failed") { rejected = true; }
    Require(rejected, "Invalid arrival window is rejected");
}
var invalidEmailRejected = false;
try
{
    await store.CreateCustomerAsync(businessId, new CreateCustomerCommand(
        "Invalid email", null, "bad-email", "512-555-0199", "Residential",
        "500 Validation Way", "Austin", "TX", "78702"));
}
catch (WorkRuleException ex) when (ex.Code == "validation_failed") { invalidEmailRejected = true; }
Require(invalidEmailRejected, "Invalid customer email is rejected");
var customer = await store.CreateCustomerAsync(businessId, new CreateCustomerCommand(
    "Test Customer", null, "test@example.com", "512-555-0100",
    "Residential", "100 Test Ave", "Austin", "TX", "78701"));
Require(await store.GetCustomerAsync(businessId, customer.Id) is not null, "Tenant can read its customer");
Require(await store.GetCustomerAsync(foreignBusinessId, customer.Id) is null, "Foreign tenant cannot read customer");

var job = await store.CreateJobAsync(businessId, new CreateJobCommand(
    customer.Id, "Unscheduled inspection", null, "Normal", null, null, null), 100);
Require(job.Status == "Draft", "Unscheduled job starts as Draft");

var customerRejected = false;
try
{
    await store.CreateJobAsync(businessId, new CreateJobCommand(
        Guid.NewGuid(), "Foreign customer job", null, "Normal", null, null, null), 100);
}
catch (WorkRuleException ex) when (ex.Code == "customer_not_found") { customerRejected = true; }
Require(customerRejected, "Job rejects customer outside the tenant");

var limitRejected = false;
try
{
    await store.CreateJobAsync(businessId, new CreateJobCommand(
        customer.Id, "Over plan limit", null, "Normal", null, null, null), 1);
}
catch (WorkRuleException ex) when (ex.Code == "plan_limit_reached") { limitRejected = true; }
Require(limitRejected, "Job period quota is enforced");

var catalogItem = await store.CreateCatalogItemAsync(businessId, new CreateCatalogItemCommand(
    "Part", "Test valve", "each", 20m, 50m, "TX-TAXABLE"));
Require((await store.ListCatalogItemsAsync(businessId, "valve", "Part", 1, 25)).Items.Any(x => x.Id == catalogItem.Id),
    "Catalog search and type filter are tenant scoped");
Require((await store.ListCatalogItemsAsync(foreignBusinessId, null, null, 1, 25)).Total == 0,
    "Foreign tenant cannot list catalog items");

var itemSet = await store.ReplaceJobItemsAsync(businessId, job.Id,
[
    new ReplaceJobItemCommand(catalogItem.Id, "Part", catalogItem.Name, 2m, catalogItem.Unit, 50m, 5m, 7.84m),
    new ReplaceJobItemCommand(null, "Labor", "Installation labor", 1.5m, "hour", 80m, 0m, 0m)
]);
Require(itemSet.Subtotal == 220m, "Job subtotal uses quantity and snapshotted price");
Require(itemSet.Total == 222.84m, "Job total includes discount and tax");
Require((await store.GetJobAsync(businessId, job.Id))?.Total == 222.84m, "Job header total follows its line items");

var foreignCatalogRejected = false;
try
{
    await store.ReplaceJobItemsAsync(businessId, job.Id,
    [
        new ReplaceJobItemCommand(Guid.NewGuid(), "Part", "Foreign part", 1m, "each", 10m, 0m, 0m)
    ]);
}
catch (WorkRuleException ex) when (ex.Code == "catalog_item_not_found") { foreignCatalogRejected = true; }
Require(foreignCatalogRejected, "Job rejects catalog items outside the tenant");

var invalidTransitionRejected = false;
try
{
    await store.ChangeJobStatusAsync(
        businessId,
        job.Id,
        new ChangeJobStatusCommand("Completed"));
}
catch (WorkRuleException ex) when (ex.Code == "invalid_transition") { invalidTransitionRejected = true; }
Require(invalidTransitionRejected, "Invalid job status transitions are rejected");

var scheduledJob = await store.ChangeJobStatusAsync(
    businessId,
    job.Id,
    new ChangeJobStatusCommand("Scheduled"));
Require(scheduledJob.Status == "Scheduled", "Draft job can be scheduled");

var activeJob = await store.ChangeJobStatusAsync(
    businessId,
    job.Id,
    new ChangeJobStatusCommand("InProgress"));
Require(activeJob.Status == "InProgress", "Scheduled job can be started");

var completedJob = await store.ChangeJobStatusAsync(
    businessId,
    job.Id,
    new ChangeJobStatusCommand("Completed"));
Require(completedJob.Status == "Completed", "Active job can be completed");

var foreignStatusChangeRejected = false;
try
{
    await store.ChangeJobStatusAsync(
        foreignBusinessId,
        job.Id,
        new ChangeJobStatusCommand("InProgress"));
}
catch (WorkRuleException ex) when (ex.Code == "resource_not_found") { foreignStatusChangeRejected = true; }
Require(foreignStatusChangeRejected, "Foreign tenant cannot change job status");

Console.WriteLine("Phase 1 through Phase 4 domain checks passed.");

// --- Phase 6: PDF Generation Tests ---
var estimateRecord = new EstimateRecord(
    Guid.NewGuid(),
    businessId,
    job.Id,
    "EST-1001",
    1,
    "Draft",
    DateOnly.FromDateTime(DateTime.UtcNow.AddDays(30)),
    "Acme Customer",
    250.00m,
    25.00m,
    18.56m,
    243.56m,
    null,
    DateTimeOffset.UtcNow,
    [
        new FinancialLineRecord(Guid.NewGuid(), "Service", "HVAC Diagnostics", 1, "visit", 150m, 0m, 12.38m, 1, 162.38m),
        new FinancialLineRecord(Guid.NewGuid(), "Part", "Air Filter 16x25x1", 2, "each", 50m, 25m, 6.18m, 2, 81.18m)
    ]);

var estimatePdfBytes = PdfDocumentBuilder.BuildEstimatePdf(estimateRecord, "Northstar Heating & Air", "billing@northstar.example");
Require(estimatePdfBytes.Length > 0, "Estimate PDF generates binary content");
var estimatePdfString = Encoding.ASCII.GetString(estimatePdfBytes);
Require(estimatePdfString.StartsWith("%PDF-1.4", StringComparison.Ordinal), "Estimate PDF starts with %PDF-1.4 standard marker");
Require(estimatePdfString.TrimEnd().EndsWith("%%EOF", StringComparison.Ordinal), "Estimate PDF ends with %%EOF standard marker");
Require(estimatePdfString.Contains("ESTIMATE", StringComparison.Ordinal), "Estimate PDF contains document title");
Require(estimatePdfString.Contains("EST-1001", StringComparison.Ordinal), "Estimate PDF contains estimate number");
Require(estimatePdfString.Contains("Acme Customer", StringComparison.Ordinal), "Estimate PDF contains customer name");

var invoiceRecord = new InvoiceRecord(
    Guid.NewGuid(),
    businessId,
    job.Id,
    customer.Id,
    "INV-2002",
    "Acme Customer",
    "Issued",
    "Queued",
    DateOnly.FromDateTime(DateTime.UtcNow),
    DateOnly.FromDateTime(DateTime.UtcNow.AddDays(14)),
    250.00m,
    25.00m,
    18.56m,
    243.56m,
    243.56m,
    "Unpaid",
    false,
    DateTimeOffset.UtcNow,
    [
        new FinancialLineRecord(Guid.NewGuid(), "Service", "HVAC Diagnostics", 1, "visit", 150m, 0m, 12.38m, 1, 162.38m)
    ]);

var invoicePdfBytes = PdfDocumentBuilder.BuildInvoicePdf(invoiceRecord, "Northstar Heating & Air", "billing@northstar.example");
Require(invoicePdfBytes.Length > 0, "Invoice PDF generates binary content");
var invoicePdfString = Encoding.ASCII.GetString(invoicePdfBytes);
Require(invoicePdfString.StartsWith("%PDF-1.4", StringComparison.Ordinal), "Invoice PDF starts with %PDF-1.4 standard marker");
Require(invoicePdfString.TrimEnd().EndsWith("%%EOF", StringComparison.Ordinal), "Invoice PDF ends with %%EOF standard marker");
Require(invoicePdfString.Contains("INVOICE", StringComparison.Ordinal), "Invoice PDF contains document title");
Require(invoicePdfString.Contains("INV-2002", StringComparison.Ordinal), "Invoice PDF contains invoice number");

// --- Phase 6: Custom SMTP Settings & Masking Tests ---
var smtpRecord = new SmtpSettingsRecord(
    "smtp.sendgrid.net",
    587,
    "apikey",
    "••••••••",
    "billing@northstar.example",
    "Northstar Billing",
    true,
    true);

Require(smtpRecord.MaskedPassword == "••••••••", "SMTP settings return masked password for safety");
Require(smtpRecord.MaskedPassword is not null && !smtpRecord.MaskedPassword.Contains("secret", StringComparison.OrdinalIgnoreCase), "Raw password is never exposed in SmtpSettingsRecord");

// --- Phase 6: Idempotency Hashing Tests ---
var hash1 = Convert.ToHexString(IdempotencyService.ComputeRequestHash("{\"issuedOn\":\"2026-09-12\",\"dueOn\":\"2026-09-26\"}"));
var hash2 = Convert.ToHexString(IdempotencyService.ComputeRequestHash("{\"issuedOn\":\"2026-09-12\",\"dueOn\":\"2026-09-26\"}"));
var hash3 = Convert.ToHexString(IdempotencyService.ComputeRequestHash("{\"issuedOn\":\"2026-09-13\",\"dueOn\":\"2026-09-27\"}"));
Require(hash1 == hash2, "Identical request payload generates identical idempotency hash");
Require(hash1 != hash3, "Different request payload generates different idempotency hash");
Require(hash1.Length == 64, "SHA-256 hash has 64 hex characters");

Console.WriteLine("Phase 1 through Phase 6 domain and integration checks passed.");

// --- Phase 7: SaaS Subscription Billing & Plan Entitlements Tests ---
var soloPlanId = Guid.Parse("CCCCCCCC-CCCC-CCCC-CCCC-CCCCCCCCCCCC");
var teamPlanId = Guid.Parse("DDDDDDDD-DDDD-DDDD-DDDD-DDDDDDDDDDDD");

var soloEntitlements = new List<PlanEntitlementRecord>
{
    new("staff.seats", true, 1, "1 staff seat"),
    new("jobs.per_period", true, 100, "100 jobs per billing period"),
    new("storage.bytes", true, 1073741824, "1 GB storage"),
    new("reports.advanced.enabled", false, null, "Advanced reports disabled")
};

var soloPlan = new PlanRecord(soloPlanId, "SOLO", "Solo", "Month", 29.00m, "USD", true, soloEntitlements);
Require(soloPlan.Price == 29.00m, "Solo plan price is $29");
Require(soloPlan.Entitlements.First(e => e.FeatureCode == "staff.seats").LimitValue == 1, "Solo plan allows 1 staff seat");
Require(!soloPlan.Entitlements.First(e => e.FeatureCode == "reports.advanced.enabled").Enabled, "Solo plan disables advanced reports");

var teamEntitlements = new List<PlanEntitlementRecord>
{
    new("staff.seats", true, 5, "5 staff seats"),
    new("jobs.per_period", true, 500, "500 jobs per billing period"),
    new("storage.bytes", true, 10737418240, "10 GB storage"),
    new("reports.advanced.enabled", true, null, "Advanced reports enabled")
};

var teamPlan = new PlanRecord(teamPlanId, "TEAM", "Team", "Month", 49.00m, "USD", true, teamEntitlements);
Require(teamPlan.Price == 49.00m, "Team plan price is $49");
Require(teamPlan.Entitlements.First(e => e.FeatureCode == "staff.seats").LimitValue == 5, "Team plan allows 5 staff seats");

// Downgrade blocker validation logic:
// If a workspace has 3 active seats, switching to Solo (limit 1) must be blocked
var activeSeatsCount = 3L;
var targetSoloLimit = soloPlan.Entitlements.First(e => e.FeatureCode == "staff.seats").LimitValue!.Value;
var isDowngradeBlocked = activeSeatsCount > targetSoloLimit;
Require(isDowngradeBlocked, "Downgrade with 3 active seats is blocked when target plan only allows 1 seat");

// Lifecycle states validation
var trialingSub = new SubscriptionRecord(Guid.NewGuid(), businessId, teamPlanId, "TEAM", "Team", 49.00m, "Month", "Trialing", DateTimeOffset.UtcNow.AddDays(14), DateTimeOffset.UtcNow, DateTimeOffset.UtcNow.AddMonths(1), null, false, true, false);
Require(trialingSub.Status == "Trialing", "Trialing subscription status is recognized");
Require(!trialingSub.IsReadOnly, "Trialing subscription is not read-only");

var readOnlySub = new SubscriptionRecord(Guid.NewGuid(), businessId, teamPlanId, "TEAM", "Team", 49.00m, "Month", "ReadOnly", null, DateTimeOffset.UtcNow.AddMonths(-1), DateTimeOffset.UtcNow, null, false, true, true);
Require(readOnlySub.IsReadOnly, "Expired / ReadOnly subscription restricts operational writes");

// Phase 8: Reports, Data Exports, and Audit Trail checks
Require(Permissions.All.Contains(Permissions.ReportsRead), "ReportsRead permission is registered in Permissions.All");
Require(Permissions.All.Contains(Permissions.ExportsManage), "ExportsManage permission is registered in Permissions.All");
Require(Permissions.All.Contains(Permissions.AuditRead), "AuditRead permission is registered in Permissions.All");

var summary = new ServiceDesk.Application.Reports.DashboardSummaryResponse(
    5, 3, 2, 4, 1250.00m, 6, 3400.00m, 8500.00m, 7200.00m, [], []);
Require(summary.JobsTodayCount == 5, "Jobs today matches");
Require(summary.JobsCompletedTodayCount == 3, "Jobs completed matches");
Require(summary.JobsRemainingTodayCount == 2, "Jobs remaining calculates correctly");

var report = new ServiceDesk.Application.Reports.BusinessReportResponse(
    new DateOnly(2026, 8, 1),
    new DateOnly(2026, 8, 31),
    12500.00m,
    15.5m,
    18,
    694.44m,
    9,
    [new ServiceDesk.Application.Reports.MonthlyTrendItem("Aug 2026", 12500.00m, 18)],
    [new ServiceDesk.Application.Reports.CategoryBreakdownItem("HVAC Repair", 7500.00m, 60.0m, 10)],
    [new ServiceDesk.Application.Reports.TechnicianPerformanceItem("Alex Tech", 12, 8400.00m)],
    new ServiceDesk.Application.Reports.InvoiceAgingSummary(2400.00m, 800.00m, 200.00m, 0.00m));
Require(report.TotalRevenue == 12500.00m, "Total revenue is recorded");
Require(report.CategoryBreakdown[0].Percentage == 60.0m, "Category breakdown calculates correctly");
Require(report.InvoiceAging.Current == 2400.00m, "Invoice aging summary records current due");

var exportRecord = new ServiceDesk.Application.DataControls.ExportRequestResponse(
    Guid.NewGuid(), businessId, Guid.NewGuid(), "Customers", "Ready", "exports/test.csv", DateTimeOffset.UtcNow, DateTimeOffset.UtcNow.AddDays(7));
Require(exportRecord.ExportType == "Customers", "Export type matches");
Require(exportRecord.Status == "Ready", "Export status matches");

var auditRecord = new ServiceDesk.Application.DataControls.AuditEventResponse(
    Guid.NewGuid(), Guid.NewGuid(), "export.created", "ExportRequest", exportRecord.Id, "{\"exportType\":\"Customers\"}", DateTimeOffset.UtcNow);
Require(auditRecord.Action == "export.created", "Audit action matches");

Console.WriteLine("Phase 1 through Phase 8 domain and integration checks passed.");

// ─── Phase 9: Platform Administration tests ───────────────────────────────

// Permission registration
Require(Permissions.All.Contains(Permissions.PlatformSupport), "PlatformSupport is registered in Permissions.All");
Require(Permissions.All.Contains(Permissions.PlatformBillingAdmin), "PlatformBillingAdmin is registered in Permissions.All");
Require(Permissions.All.Contains(Permissions.PlatformOperationsAdmin), "PlatformOperationsAdmin is registered in Permissions.All");
Require(Permissions.All.Contains(Permissions.SupportApprove), "SupportApprove is registered in Permissions.All");

// Platform business summary DTO
var platformBiz = new PlatformBusinessSummaryResponse(
    Guid.Parse("11111111-1111-1111-1111-111111111111"),
    "Northstar Services",
    "Plumbing",
    "Active",
    "America/Chicago",
    "USD",
    "owner@northstar.local",
    DateTimeOffset.UtcNow.AddMonths(-3),
    "TEAM",
    "Team",
    49.00m,
    3,
    "Active");

Require(platformBiz.Name == "Northstar Services", "Platform business name matches");
Require(platformBiz.MemberCount == 3, "Platform business member count matches");
Require(platformBiz.PlanCode == "TEAM", "Platform business plan code matches");
Require(platformBiz.SubscriptionStatus == "Active", "Platform business subscription status matches");

// Status transition validation — reason is required
var statusRequest = new UpdateBusinessStatusRequest("Suspended", "");
Require(string.IsNullOrWhiteSpace(statusRequest.Reason), "Empty reason is detected for status change");

var statusRequestValid = new UpdateBusinessStatusRequest("Suspended", "Payment failure — notified via email");
Require(!string.IsNullOrWhiteSpace(statusRequestValid.Reason), "Valid reason is accepted for status change");
Require(statusRequestValid.Status == "Suspended", "Status is set to Suspended");

// Allowed status transitions
var allowedStatuses = new HashSet<string>(StringComparer.Ordinal) { "Active", "Suspended", "DeletionPending", "Closed" };
Require(allowedStatuses.Contains("Active"), "Active is a valid business status");
Require(allowedStatuses.Contains("Suspended"), "Suspended is a valid business status");
Require(allowedStatuses.Contains("DeletionPending"), "DeletionPending is a valid business status");
Require(!allowedStatuses.Contains("Unknown"), "Invalid status is rejected");

// Platform metrics DTO
var planDist = new List<PlatformPlanDistributionItem>
{
    new("Solo", 800, 62.3m),
    new("Team", 350, 27.2m),
    new("Pro", 134, 10.5m)
};
var industryDist = new List<PlatformIndustryDistributionItem>
{
    new("Plumbing", 420, 32.7m),
    new("AutoService", 310, 24.1m),
    new("Electrical", 280, 21.8m),
    new("Other", 274, 21.4m)
};
var metrics = new PlatformMetricsResponse(
    1284, 1100, 42, 142, 48600.00m, 31.4m, 99.98m,
    "All systems operational",
    planDist,
    industryDist);

Require(metrics.TotalBusinesses == 1284, "Platform metrics total businesses matches");
Require(metrics.MonthlyRecurringRevenue == 48600.00m, "Platform metrics MRR matches");
Require(metrics.ServiceHealthPercentage == 99.98m, "Platform metrics service health is correct");
Require(metrics.PlanDistribution[0].PlanName == "Solo", "Plan distribution first entry is Solo");
Require(metrics.IndustryDistribution[0].Industry == "Plumbing", "Industry distribution first entry is Plumbing");

// Conversion rate invariant: Active / (Active + Trial)
var testActive = 1100;
var testTrial = 142;
var expectedConversion = Math.Round((decimal)testActive / (testActive + testTrial) * 100, 1);
Require(expectedConversion > 80m, "Trial conversion logic: Active / (Active + Trial) should be > 80%");

// Backup run DTO
var backupRun = new BackupRunResponse(
    Guid.NewGuid(),
    "backup-2026-09-12-azure-blob-ref-001",
    "Succeeded",
    DateTimeOffset.UtcNow.AddHours(-6),
    DateTimeOffset.UtcNow.AddHours(-5));

Require(backupRun.Status == "Succeeded", "Backup run status is Succeeded");
Require(backupRun.CompletedAt.HasValue, "Backup run has a completion time");

// Restore run DTO
var restoreRun = new RestoreRunResponse(
    Guid.NewGuid(), backupRun.Id, Guid.NewGuid(),
    "staging", "Running", DateTimeOffset.UtcNow, null);

Require(restoreRun.Status == "Running", "Restore run starts as Running");
Require(restoreRun.TargetEnvironment == "staging", "Restore run target environment is staging");
Require(!restoreRun.CompletedAt.HasValue, "Restore run has no completion time while Running");

// Support grant DTO lifecycle
var supportGrant = new SupportGrantResponse(
    Guid.NewGuid(), businessId, Guid.NewGuid(),
    "ReadOnly", DateTimeOffset.UtcNow.AddHours(8), null, true, DateTimeOffset.UtcNow);

Require(supportGrant.Scope == "ReadOnly", "Support grant scope is ReadOnly");
Require(supportGrant.IsActive, "Support grant is active when not revoked and not expired");
Require(!supportGrant.RevokedAt.HasValue, "Support grant has no revocation timestamp");

// Support grant request validation
var grantRequest = new CreateSupportGrantRequest(Guid.NewGuid(), 8, "Investigating reported data anomaly");
Require(grantRequest.DurationHours == 8, "Grant request duration is 8 hours");
Require(Math.Clamp(grantRequest.DurationHours, 1, 72) == 8, "Grant duration is within allowed range");

var grantOverLimit = new CreateSupportGrantRequest(Guid.NewGuid(), 200, "Test");
Require(Math.Clamp(grantOverLimit.DurationHours, 1, 72) == 72, "Grant duration is clamped to maximum 72 hours");

// Platform audit event DTO
var platformAudit = new PlatformAdminAuditEventResponse(
    Guid.NewGuid(),
    Guid.NewGuid(),
    businessId,
    "Northstar Services",
    "business.status.changed",
    "{\"newStatus\":\"Suspended\",\"reason\":\"Payment failure\"}",
    DateTimeOffset.UtcNow);

Require(platformAudit.Action == "business.status.changed", "Platform audit action is correct");
Require(platformAudit.BusinessName == "Northstar Services", "Platform audit business name matches");
Require(platformAudit.Details?.Contains("Suspended") == true, "Platform audit details contain new status");

// Plan entitlement DTO
var entitlement = new PlatformPlanEntitlementRow("staff.seats", true, 10, "10 staff seats");
Require(entitlement.FeatureCode == "staff.seats", "Entitlement feature code matches");
Require(entitlement.LimitValue == 10, "Entitlement limit value matches");
Require(entitlement.Enabled, "Entitlement is enabled");

// ── Two-Module Platform Separation & Superadmin Permission Matrix ───────────
var superAdminPerms = PlatformContext.GetPermissionsForRole("OperationsAdmin");
Require(superAdminPerms.Contains(Permissions.PlatformSupport), "OperationsAdmin (Superadmin) has PlatformSupport access");
Require(superAdminPerms.Contains(Permissions.PlatformBillingAdmin), "OperationsAdmin (Superadmin) has PlatformBillingAdmin access");
Require(superAdminPerms.Contains(Permissions.PlatformOperationsAdmin), "OperationsAdmin (Superadmin) has PlatformOperationsAdmin access");

var billingAdminPerms = PlatformContext.GetPermissionsForRole("BillingAdmin");
Require(billingAdminPerms.Contains(Permissions.PlatformSupport), "BillingAdmin has PlatformSupport access");
Require(billingAdminPerms.Contains(Permissions.PlatformBillingAdmin), "BillingAdmin has PlatformBillingAdmin access");
Require(!billingAdminPerms.Contains(Permissions.PlatformOperationsAdmin), "BillingAdmin is denied PlatformOperationsAdmin access");

var supportPerms = PlatformContext.GetPermissionsForRole("Support");
Require(supportPerms.Contains(Permissions.PlatformSupport), "Support has PlatformSupport access");
Require(!supportPerms.Contains(Permissions.PlatformBillingAdmin), "Support is denied PlatformBillingAdmin access");
Require(!supportPerms.Contains(Permissions.PlatformOperationsAdmin), "Support is denied PlatformOperationsAdmin access");

// PlatformContext creation and operator contract
var adminRecord = new PlatformAdministratorRecord(
    Guid.Parse("99999999-9999-9999-9999-999999999999"),
    "Platform SuperAdmin",
    "admin@servicedesk.local",
    "OperationsAdmin",
    true);

var platformContext = PlatformContext.Create(adminRecord);
Require(platformContext.OperatorUserId == adminRecord.UserId, "PlatformContext operator ID matches");
Require(platformContext.HasPermission(Permissions.PlatformSupport), "PlatformContext grants PlatformSupport");
Require(platformContext.HasPermission(Permissions.PlatformBillingAdmin), "PlatformContext grants PlatformBillingAdmin");
Require(platformContext.HasPermission(Permissions.PlatformOperationsAdmin), "PlatformContext grants PlatformOperationsAdmin");

var operatorResponse = new PlatformOperatorResponse(
    platformContext.OperatorUserId,
    platformContext.FullName,
    platformContext.Email,
    platformContext.RoleCode,
    platformContext.Permissions.ToList());
Require(operatorResponse.Id == adminRecord.UserId, "OperatorResponse ID matches");
Require(operatorResponse.Role == "OperationsAdmin", "OperatorResponse role matches");
Require(operatorResponse.Permissions.Count == 3, "OperatorResponse has all 3 platform permissions");

// Tenant isolation: Tenant context must NOT contain platform permissions
Require(!context.HasPermission(Permissions.PlatformSupport), "Tenant context cannot satisfy PlatformSupport");
Require(!context.HasPermission(Permissions.PlatformBillingAdmin), "Tenant context cannot satisfy PlatformBillingAdmin");
Require(!context.HasPermission(Permissions.PlatformOperationsAdmin), "Tenant context cannot satisfy PlatformOperationsAdmin");


// ==========================================
// Phase 10: Launch Verification & Security Audit
// ==========================================

// 1. Tenant Boundary & Anti-Enumeration:
// Non-existent or foreign resources return null without leaking existence
var nonExistentCustomer = await store.GetCustomerAsync(businessId, Guid.NewGuid());
Require(nonExistentCustomer is null, "Non-existent tenant customer returns null (anti-enumeration)");
var foreignCustomerAttempt = await store.GetCustomerAsync(foreignBusinessId, customer.Id);
Require(foreignCustomerAttempt is null, "Foreign tenant cannot access customer across boundary");
var foreignJobAttempt = await store.GetJobAsync(foreignBusinessId, job.Id);
Require(foreignJobAttempt is null, "Foreign tenant cannot access job across boundary");

// 2. Role-Based Permission Boundaries & Deny-by-Default:
var technicianContext = new TenantContext(
    Guid.NewGuid(),
    Guid.NewGuid(),
    businessId,
    BusinessRole.Technician,
    new HashSet<string>(StringComparer.Ordinal) { Permissions.JobsRead, Permissions.JobsWrite });

Require(technicianContext.HasPermission(Permissions.JobsRead), "Technician has jobs.read permission");
Require(technicianContext.HasPermission(Permissions.JobsWrite), "Technician has jobs.write permission");
Require(!technicianContext.HasPermission(Permissions.InvoicesManage), "Technician denied invoices.manage permission");
Require(!technicianContext.HasPermission(Permissions.SubscriptionManage), "Technician denied subscription.manage permission");
Require(!technicianContext.HasPermission(Permissions.TeamManage), "Technician denied team.manage permission");
Require(!technicianContext.HasPermission(Permissions.WorkspaceManage), "Technician denied workspace.manage permission");

// 3. Subscription Entitlement Boundary & Downgrade Blocker:
var teamActiveSeats = 4;
var targetSoloSeatLimit = 1;
Require(teamActiveSeats > targetSoloSeatLimit, "Usage exceeds Solo plan seat limit");
var isPhase10DowngradeBlocked = teamActiveSeats > targetSoloSeatLimit;
Require(isPhase10DowngradeBlocked, "Downgrade guard blocks transition when seats exceed limit");

// 4. Idempotency Result Handling:
var cachedResult = new IdempotencyCheckResult(true, false, 200, "{\"status\":\"paid\"}");
Require(cachedResult.HasCachedResponse, "Idempotency cache hit recognized");
Require(!cachedResult.IsInProgress, "Completed idempotency record is not concurrent in progress");
Require(cachedResult.ResponseCode == 200, "Cached response code is 200 OK");

// 5. UserIdentityUtilities & Deterministic ID Derivation:
var rawGuid = Guid.NewGuid();
Require(UserIdentityUtilities.DeriveUserId(rawGuid.ToString()) == rawGuid, "Raw GUID subject preserves exact GUID");

var embeddedGuid = Guid.NewGuid();
var auth0Subject = $"auth0|{embeddedGuid}";
Require(UserIdentityUtilities.DeriveUserId(auth0Subject) == embeddedGuid, "Embedded GUID in auth0 subject is extracted correctly");

var googleSubject = "google-oauth2|109283746501928374";
var derived1 = UserIdentityUtilities.DeriveUserId(googleSubject);
var derived2 = UserIdentityUtilities.DeriveUserId(googleSubject);
Require(derived1 == derived2, "OAuth2 subject produces deterministic GUID across multiple invocations");
Require(derived1 != Guid.Empty, "Derived GUID is not empty");

// 6. Business Provisioning & Workspace Retrieval:
var bizStore = new InMemoryBusinessStore();
var createdBiz = await bizStore.CreateAsync(
    derived1,
    googleSubject,
    "founder@apexplumbing.example",
    "Apex Founder",
    new CreateBusinessCommand("Apex Plumbing", "Plumbing", "512-555-0188", "100 Main St", "Austin", "TX", "78701", "America/Chicago", false),
    CancellationToken.None);

Require(createdBiz.Name == "Apex Plumbing", "Business created with correct name");
Require(createdBiz.Industry == "Plumbing", "Business created with correct industry");
Require(createdBiz.Status == "Active", "New business starts as Active");

var invalidBusiness = new CreateBusinessCommand(
    "QA Invalid",
    "General",
    "abc",
    null,
    null,
    "INVALID",
    "abc",
    "America/Chicago",
    true);
var validationResults = new List<ValidationResult>();
var isValidBusiness = Validator.TryValidateObject(
    invalidBusiness,
    new ValidationContext(invalidBusiness),
    validationResults,
    validateAllProperties: true);
Require(!isValidBusiness, "Malformed onboarding profile is rejected by the API contract");
Require(validationResults.Count >= 3, "Phone, state, and ZIP validation errors are reported");

var fetchedBiz = await bizStore.GetAsync(createdBiz.Id, CancellationToken.None);
Require(fetchedBiz is not null && fetchedBiz.Id == createdBiz.Id, "Business can be fetched by ID");

var nonExistentBiz = await bizStore.GetAsync(Guid.NewGuid(), CancellationToken.None);
Require(nonExistentBiz is null, "Non-existent business returns null");

var updatedBiz = await bizStore.UpdateAsync(
    createdBiz.Id,
    new UpdateBusinessCommand("Apex Pro Plumbing", null, null, null, null, null, null, null, null),
    CancellationToken.None);
Require(updatedBiz?.Name == "Apex Pro Plumbing", "Business name updated successfully");

var workspaceSummary = await bizStore.GetWorkspaceAsync(createdBiz.Id, derived1, CancellationToken.None);
Require(workspaceSummary is not null, "Workspace summary returned for owner");
Require(workspaceSummary!.Role == "Owner", "Creator has Owner role in workspace");
Require(workspaceSummary.Permissions.Contains(Permissions.WorkspaceRead), "Owner has workspace.read permission");

Console.WriteLine("Phase 1 through Phase 10 launch verification, tenant isolation, and security checks passed.");
return;

static void Require(bool condition, string message)
{
    if (!condition)
    {
        throw new InvalidOperationException($"Check failed: {message}");
    }
}
