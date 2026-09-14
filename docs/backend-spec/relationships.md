# Database relationships

SQL Server. Composite tenant keys are `(BusinessId, Id)`. All app tables reference Businesses; those repeated edges are omitted below for readability.

## Access and subscriptions

```mermaid
erDiagram
    Users {
        uuid Id PK
        nvarchar Subject
        nvarchar Email
        nvarchar NormalizedEmail
        nvarchar FullName
        varchar Status
        datetime2 CreatedAt
    }
    Roles {
        nvarchar Code
        nvarchar Name
    }
    RolePermissions {
        nvarchar RoleCode
        nvarchar PermissionCode
    }
    Roles ||--o{ RolePermissions : "references"
    Permissions ||--o{ RolePermissions : "references"
    Businesses {
        uuid Id PK
        nvarchar Name
        varchar Industry
        varchar Status
        nvarchar TimeZone
        char Currency
        nvarchar BillingEmail
    }
    Members {
        uuid BusinessId
        uuid Id PK
        uuid UserId
        nvarchar RoleCode
        varchar Status
        datetime2 DeactivatedAt
        datetime2 CreatedAt
    }
    Users ||--o{ Members : "references"
    Roles ||--o{ Members : "references"
    Invitations {
        uuid BusinessId
        uuid Id PK
        nvarchar Email
        nvarchar NormalizedEmail
        nvarchar RoleCode
        binary TokenHash
        varchar Status
    }
    Members ||--o{ Invitations : "references"
    Users ||--o{ Invitations : "references"
    Roles ||--o{ Invitations : "references"
    Plans {
        uuid Id PK
        nvarchar Code
        int Revision
        nvarchar Name
        varchar BillingInterval
        decimal Price
        char Currency
    }
    PlanEntitlements {
        uuid PlanId
        nvarchar FeatureCode
        bit Enabled
        bigint LimitValue
        nvarchar DisplayText
    }
    Plans ||--o{ PlanEntitlements : "references"
    Subscriptions {
        uuid BusinessId
        uuid Id PK
        uuid PlanId
        nvarchar ProviderCustomerId
        nvarchar ProviderSubscriptionId
        varchar Status
        datetime2 TrialEndsAt
    }
    Plans ||--o{ Subscriptions : "references"
    PlanChanges {
        uuid BusinessId
        uuid Id PK
        uuid SubscriptionId
        uuid TargetPlanId
        varchar Status
        datetime2 EffectiveAt
        nvarchar BlockedReason
    }
    Subscriptions ||--o{ PlanChanges : "references"
    Plans ||--o{ PlanChanges : "references"
    SubscriptionInvoices {
        uuid BusinessId
        uuid Id PK
        uuid SubscriptionId
        nvarchar ProviderInvoiceId
        varchar Status
        decimal Total
        char Currency
    }
    Subscriptions ||--o{ SubscriptionInvoices : "references"
    UsageCounters {
        uuid BusinessId
        uuid Id PK
        nvarchar FeatureCode
        datetime2 PeriodStartsAt
        datetime2 PeriodEndsAt
        bigint UsedQuantity
        datetime2 CreatedAt
    }
```

## Service operations

```mermaid
erDiagram
    Customers {
        uuid BusinessId
        uuid Id PK
        nvarchar Name
        nvarchar CompanyName
        nvarchar Email
        nvarchar Phone
        varchar CustomerType
    }
    Locations {
        uuid BusinessId
        uuid Id PK
        uuid CustomerId
        nvarchar Label
        nvarchar AddressLine1
        nvarchar AddressLine2
        nvarchar City
    }
    Customers ||--o{ Locations : "references"
    Assets {
        uuid BusinessId
        uuid Id PK
        uuid CustomerId
        nvarchar AssetType
        nvarchar Label
        nvarchar VinOrSerial
        nvarchar Details
    }
    Customers ||--o{ Assets : "references"
    CatalogItems {
        uuid BusinessId
        uuid Id PK
        varchar ItemType
        nvarchar Name
        nvarchar Unit
        decimal UnitCost
        decimal UnitPrice
    }
    Jobs {
        uuid BusinessId
        uuid Id PK
        uuid CustomerId
        uuid LocationId
        uuid AssetId
        nvarchar JobNumber
        nvarchar Title
    }
    Customers ||--o{ Jobs : "references"
    Locations ||--o{ Jobs : "references"
    Assets ||--o{ Jobs : "references"
    Members ||--o{ Jobs : "references"
    JobAssignments {
        uuid BusinessId
        uuid Id PK
        uuid JobId
        uuid MemberId
        bit IsActive
        datetime2 CreatedAt
        datetime2 UpdatedAt
    }
    Jobs ||--o{ JobAssignments : "references"
    Members ||--o{ JobAssignments : "references"
    Appointments {
        uuid BusinessId
        uuid Id PK
        uuid JobId
        datetime2 StartsAt
        datetime2 EndsAt
        varchar Status
        datetime2 CreatedAt
    }
    Jobs ||--o{ Appointments : "references"
    AppointmentStaff {
        uuid BusinessId
        uuid Id PK
        uuid JobId
        uuid AppointmentId
        uuid MemberId
        datetime2 CreatedAt
        datetime2 UpdatedAt
    }
    Appointments ||--o{ AppointmentStaff : "references"
    JobAssignments ||--o{ AppointmentStaff : "references"
    JobItems {
        uuid BusinessId
        uuid Id PK
        uuid JobId
        uuid CatalogItemId
        varchar ItemType
        nvarchar Description
        decimal Quantity
    }
    Jobs ||--o{ JobItems : "references"
    CatalogItems ||--o{ JobItems : "references"
    TimeEntries {
        uuid BusinessId
        uuid Id PK
        uuid JobId
        uuid MemberId
        datetime2 StartsAt
        datetime2 EndsAt
        datetime2 CreatedAt
    }
    Jobs ||--o{ TimeEntries : "references"
    Members ||--o{ TimeEntries : "references"
    JobNotes {
        uuid BusinessId
        uuid Id PK
        uuid JobId
        uuid AuthorMemberId
        nvarchar Note
        datetime2 CreatedAt
        datetime2 UpdatedAt
    }
    Jobs ||--o{ JobNotes : "references"
    Members ||--o{ JobNotes : "references"
    JobFiles {
        uuid BusinessId
        uuid Id PK
        uuid JobId
        uuid UploadedByMemberId
        nvarchar StorageKey
        nvarchar FileName
        nvarchar MimeType
    }
    Jobs ||--o{ JobFiles : "references"
    Members ||--o{ JobFiles : "references"
    JobChecklistItems {
        uuid BusinessId
        uuid Id PK
        uuid JobId
        nvarchar Label
        bit IsRequired
        bit IsCompleted
        uuid CompletedByMemberId
    }
    Jobs ||--o{ JobChecklistItems : "references"
    Members ||--o{ JobChecklistItems : "references"
```

## Documents and controls

```mermaid
erDiagram
    Estimates {
        uuid BusinessId
        uuid Id PK
        uuid JobId
        nvarchar EstimateNumber
        int Revision
        varchar Status
        date ValidUntil
    }
    Jobs ||--o{ Estimates : "references"
    EstimateItems {
        uuid BusinessId
        uuid Id PK
        uuid EstimateId
        varchar ItemType
        nvarchar Description
        decimal Quantity
        nvarchar Unit
    }
    Estimates ||--o{ EstimateItems : "references"
    EstimateDecisions {
        uuid BusinessId
        uuid Id PK
        uuid EstimateId
        varchar Decision
        nvarchar ApproverName
        nvarchar ApproverEmail
        nvarchar EvidenceReference
    }
    Estimates ||--o{ EstimateDecisions : "references"
    PublicLinks {
        uuid BusinessId
        uuid Id PK
        uuid EstimateId
        binary TokenHash
        datetime2 ExpiresAt
        datetime2 ConsumedAt
        datetime2 RevokedAt
    }
    Estimates ||--o{ PublicLinks : "references"
    Invoices {
        uuid BusinessId
        uuid Id PK
        uuid JobId
        uuid CustomerId
        nvarchar InvoiceNumber
        varchar Status
        varchar DeliveryStatus
    }
    Jobs ||--o{ Invoices : "references"
    InvoiceItems {
        uuid BusinessId
        uuid Id PK
        uuid InvoiceId
        varchar ItemType
        nvarchar Description
        decimal Quantity
        nvarchar Unit
    }
    Invoices ||--o{ InvoiceItems : "references"
    Payments {
        uuid BusinessId
        uuid Id PK
        uuid InvoiceId
        decimal Amount
        varchar Method
        varchar Status
        nvarchar ExternalReference
    }
    Invoices ||--o{ Payments : "references"
    Members ||--o{ Payments : "references"
    PaymentRefunds {
        uuid BusinessId
        uuid Id PK
        uuid PaymentId
        decimal Amount
        varchar Status
        nvarchar Reason
        nvarchar ExternalReference
    }
    Payments ||--o{ PaymentRefunds : "references"
    CreditNotes {
        uuid BusinessId
        uuid Id PK
        uuid InvoiceId
        nvarchar CreditNumber
        decimal Amount
        nvarchar Reason
        uuid CreatedByMemberId
    }
    Invoices ||--o{ CreditNotes : "references"
    Members ||--o{ CreditNotes : "references"
    ExportRequests {
        uuid BusinessId
        uuid Id PK
        uuid RequestedByMemberId
        varchar ExportType
        varchar Status
        nvarchar Filters
        nvarchar StorageKey
    }
    Members ||--o{ ExportRequests : "references"
    AuditEvents {
        uuid BusinessId
        uuid Id PK
        uuid ActorUserId
        nvarchar Action
        nvarchar EntityType
        uuid EntityId
        nvarchar CorrelationId
    }
    Users ||--o{ AuditEvents : "references"
    SupportAccessGrants {
        uuid BusinessId
        uuid Id PK
        uuid AdminUserId
        uuid ApprovedByMemberId
        varchar Scope
        datetime2 ExpiresAt
        datetime2 RevokedAt
    }
    Administrators ||--o{ SupportAccessGrants : "references"
    Members ||--o{ SupportAccessGrants : "references"
    BackupRuns {
        uuid Id PK
        nvarchar ProviderReference
        varchar Status
        datetime2 StartedAt
        datetime2 CompletedAt
    }
    RestoreRuns {
        uuid Id PK
        uuid BackupRunId
        uuid RequestedByUserId
        nvarchar TargetEnvironment
        varchar Status
        datetime2 StartedAt
        datetime2 CompletedAt
    }
    BackupRuns ||--o{ RestoreRuns : "references"
    Users ||--o{ RestoreRuns : "references"
```

Optional nullable foreign keys are shown as general one-to-many relationships here; SQL is authoritative for nullability and constraints.
