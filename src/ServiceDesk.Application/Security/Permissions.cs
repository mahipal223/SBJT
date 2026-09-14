namespace ServiceDesk.Application.Security;

public static class Permissions
{
    public const string WorkspaceRead = "workspace.read";
    public const string WorkspaceManage = "workspace.manage";
    public const string TeamManage = "team.manage";
    public const string SubscriptionManage = "subscription.manage";
    public const string CustomersRead = "customers.read";
    public const string CustomersWrite = "customers.write";
    public const string JobsRead = "jobs.read";
    public const string JobsWrite = "jobs.write";
    public const string CatalogRead = "catalog.read";
    public const string CatalogWrite = "catalog.write";
    public const string EstimatesManage = "estimates.manage";
    public const string InvoicesManage = "invoices.manage";
    public const string PaymentsManage = "payments.manage";
    public const string ReportsRead = "reports.read";
    public const string ExportsManage = "exports.manage";
    public const string AuditRead = "audit.read";
    public const string SupportApprove = "support.approve";
    public const string PlatformSupport = "platform:Support";
    public const string PlatformBillingAdmin = "platform:BillingAdmin";
    public const string PlatformOperationsAdmin = "platform:OperationsAdmin";

    public static readonly IReadOnlySet<string> All = new HashSet<string>(StringComparer.Ordinal)
    {
        WorkspaceRead,
        WorkspaceManage,
        TeamManage,
        SubscriptionManage,
        CustomersRead,
        CustomersWrite,
        JobsRead,
        JobsWrite,
        CatalogRead,
        CatalogWrite,
        EstimatesManage,
        InvoicesManage,
        PaymentsManage,
        ReportsRead,
        ExportsManage,
        AuditRead,
        SupportApprove,
        PlatformSupport,
        PlatformBillingAdmin,
        PlatformOperationsAdmin
    };
}
