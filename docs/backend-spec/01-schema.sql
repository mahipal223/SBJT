-- ServiceDesk initial SQL Server schema. Run ONCE in a new empty database.
-- SQL Server 2019+ / Azure SQL. Database creation is intentionally separate.
-- All dates named *At are UTC; *On fields are business-local dates.
SET XACT_ABORT ON;
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO
CREATE SCHEMA auth;
GO
CREATE SCHEMA platform;
GO
CREATE SCHEMA app;
GO
CREATE SCHEMA security;
GO
BEGIN TRANSACTION;

CREATE TABLE auth.Users (
  Id uniqueidentifier NOT NULL DEFAULT NEWSEQUENTIALID(),
  Subject nvarchar(200) NOT NULL,
  Email nvarchar(254) NOT NULL,
  NormalizedEmail nvarchar(254) NOT NULL,
  FullName nvarchar(200) NOT NULL,
  Status varchar(32) NOT NULL DEFAULT 'Active' CHECK (Status IN ('Active','Disabled')),
  CreatedAt datetime2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  UpdatedAt datetime2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  Version rowversion NOT NULL,
  PRIMARY KEY (Id),
  UNIQUE (Subject),
  UNIQUE (NormalizedEmail)
);

CREATE TABLE auth.Roles (
  Code nvarchar(32) NOT NULL,
  Name nvarchar(80) NOT NULL,
  PRIMARY KEY (Code)
);

CREATE TABLE auth.Permissions (
  Code nvarchar(80) NOT NULL,
  Description nvarchar(300) NOT NULL,
  PRIMARY KEY (Code)
);

CREATE TABLE auth.RolePermissions (
  RoleCode nvarchar(32) NOT NULL,
  PermissionCode nvarchar(80) NOT NULL,
  PRIMARY KEY (RoleCode,PermissionCode),
  FOREIGN KEY (RoleCode) REFERENCES auth.Roles(Code),
  FOREIGN KEY (PermissionCode) REFERENCES auth.Permissions(Code)
);

CREATE TABLE platform.Businesses (
  Id uniqueidentifier NOT NULL DEFAULT NEWSEQUENTIALID(),
  Name nvarchar(200) NOT NULL,
  Industry varchar(32) NOT NULL DEFAULT 'Other' CHECK (Industry IN ('Plumbing','AutoService','Electrical','Other')),
  Status varchar(32) NOT NULL DEFAULT 'Active' CHECK (Status IN ('Active','Suspended','DeletionPending','Closed')),
  TimeZone nvarchar(80) NOT NULL,
  Currency char(3) NOT NULL DEFAULT 'USD' CHECK (Currency='USD'),
  BillingEmail nvarchar(254) NOT NULL,
  Settings nvarchar(max) NULL CHECK (ISJSON(Settings)=1),
  CreatedAt datetime2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  UpdatedAt datetime2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  Version rowversion NOT NULL,
  PRIMARY KEY (Id)
);

CREATE TABLE app.Members (
  BusinessId uniqueidentifier NOT NULL,
  Id uniqueidentifier NOT NULL DEFAULT NEWSEQUENTIALID(),
  UserId uniqueidentifier NOT NULL,
  RoleCode nvarchar(32) NOT NULL,
  Status varchar(32) NOT NULL DEFAULT 'Active' CHECK (Status IN ('Active','Inactive')),
  DeactivatedAt datetime2(3) NULL,
  CreatedAt datetime2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  UpdatedAt datetime2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  Version rowversion NOT NULL,
  PRIMARY KEY (BusinessId,Id),
  FOREIGN KEY (BusinessId) REFERENCES platform.Businesses(Id),
  FOREIGN KEY (UserId) REFERENCES auth.Users(Id),
  FOREIGN KEY (RoleCode) REFERENCES auth.Roles(Code),
  UNIQUE (BusinessId,UserId)
);

CREATE TABLE app.Invitations (
  BusinessId uniqueidentifier NOT NULL,
  Id uniqueidentifier NOT NULL DEFAULT NEWSEQUENTIALID(),
  Email nvarchar(254) NOT NULL,
  NormalizedEmail nvarchar(254) NOT NULL,
  RoleCode nvarchar(32) NOT NULL,
  TokenHash binary(32) NOT NULL,
  Status varchar(32) NOT NULL DEFAULT 'Pending' CHECK (Status IN ('Pending','Accepted','Revoked','Expired')),
  InvitedByMemberId uniqueidentifier NOT NULL,
  AcceptedByUserId uniqueidentifier NULL,
  ExpiresAt datetime2(3) NOT NULL,
  AcceptedAt datetime2(3) NULL,
  CreatedAt datetime2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  UpdatedAt datetime2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  Version rowversion NOT NULL,
  PRIMARY KEY (BusinessId,Id),
  FOREIGN KEY (BusinessId) REFERENCES platform.Businesses(Id),
  FOREIGN KEY (BusinessId,InvitedByMemberId) REFERENCES app.Members(BusinessId,Id),
  FOREIGN KEY (AcceptedByUserId) REFERENCES auth.Users(Id),
  FOREIGN KEY (RoleCode) REFERENCES auth.Roles(Code),
  CHECK (RoleCode IN ('Manager','Technician')),
  UNIQUE (TokenHash)
);

CREATE TABLE platform.Plans (
  Id uniqueidentifier NOT NULL DEFAULT NEWSEQUENTIALID(),
  Code nvarchar(40) NOT NULL,
  Revision int NOT NULL CHECK (Revision>0),
  Name nvarchar(100) NOT NULL,
  BillingInterval varchar(32) NOT NULL DEFAULT 'Month' CHECK (BillingInterval IN ('Month','Year')),
  Price decimal(19,2) NOT NULL DEFAULT 0 CHECK (Price >= 0),
  Currency char(3) NOT NULL DEFAULT 'USD',
  ProviderPriceId nvarchar(200) NULL,
  IsPublished bit NOT NULL DEFAULT 0,
  CreatedAt datetime2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  UpdatedAt datetime2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  Version rowversion NOT NULL,
  PRIMARY KEY (Id),
  UNIQUE (Code,Revision,BillingInterval)
);

CREATE TABLE platform.PlanEntitlements (
  PlanId uniqueidentifier NOT NULL,
  FeatureCode nvarchar(60) NOT NULL,
  Enabled bit NOT NULL DEFAULT 1,
  LimitValue bigint NULL CHECK (LimitValue IS NULL OR LimitValue>=0),
  DisplayText nvarchar(200) NOT NULL,
  PRIMARY KEY (PlanId,FeatureCode),
  FOREIGN KEY (PlanId) REFERENCES platform.Plans(Id)
);

CREATE TABLE app.Subscriptions (
  BusinessId uniqueidentifier NOT NULL,
  Id uniqueidentifier NOT NULL DEFAULT NEWSEQUENTIALID(),
  PlanId uniqueidentifier NOT NULL,
  ProviderCustomerId nvarchar(200) NULL,
  ProviderSubscriptionId nvarchar(200) NULL,
  Status varchar(32) NOT NULL DEFAULT 'Trialing' CHECK (Status IN ('Trialing','Active','PastDue','ReadOnly','Ended')),
  TrialEndsAt datetime2(3) NULL,
  PeriodStartsAt datetime2(3) NOT NULL,
  PeriodEndsAt datetime2(3) NOT NULL,
  GraceEndsAt datetime2(3) NULL,
  CancelAtPeriodEnd bit NOT NULL DEFAULT 0,
  IsCurrent bit NOT NULL DEFAULT 1,
  CreatedAt datetime2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  UpdatedAt datetime2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  Version rowversion NOT NULL,
  PRIMARY KEY (BusinessId,Id),
  FOREIGN KEY (BusinessId) REFERENCES platform.Businesses(Id),
  FOREIGN KEY (PlanId) REFERENCES platform.Plans(Id),
  CHECK (PeriodEndsAt>PeriodStartsAt)
);

CREATE TABLE app.PlanChanges (
  BusinessId uniqueidentifier NOT NULL,
  Id uniqueidentifier NOT NULL DEFAULT NEWSEQUENTIALID(),
  SubscriptionId uniqueidentifier NOT NULL,
  TargetPlanId uniqueidentifier NOT NULL,
  Status varchar(32) NOT NULL DEFAULT 'Pending' CHECK (Status IN ('Pending','Applied','Blocked','Cancelled')),
  EffectiveAt datetime2(3) NOT NULL,
  BlockedReason nvarchar(500) NULL,
  CreatedAt datetime2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  UpdatedAt datetime2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  Version rowversion NOT NULL,
  PRIMARY KEY (BusinessId,Id),
  FOREIGN KEY (BusinessId) REFERENCES platform.Businesses(Id),
  FOREIGN KEY (BusinessId,SubscriptionId) REFERENCES app.Subscriptions(BusinessId,Id),
  FOREIGN KEY (TargetPlanId) REFERENCES platform.Plans(Id)
);

CREATE TABLE app.SubscriptionInvoices (
  BusinessId uniqueidentifier NOT NULL,
  Id uniqueidentifier NOT NULL DEFAULT NEWSEQUENTIALID(),
  SubscriptionId uniqueidentifier NOT NULL,
  ProviderInvoiceId nvarchar(200) NOT NULL,
  Status varchar(32) NOT NULL DEFAULT 'Open' CHECK (Status IN ('Open','Paid','Void','Uncollectible')),
  Total decimal(19,2) NOT NULL DEFAULT 0 CHECK (Total >= 0),
  Currency char(3) NOT NULL DEFAULT 'USD',
  DueAt datetime2(3) NULL,
  PaidAt datetime2(3) NULL,
  CreatedAt datetime2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  UpdatedAt datetime2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  Version rowversion NOT NULL,
  PRIMARY KEY (BusinessId,Id),
  FOREIGN KEY (BusinessId) REFERENCES platform.Businesses(Id),
  FOREIGN KEY (BusinessId,SubscriptionId) REFERENCES app.Subscriptions(BusinessId,Id),
  UNIQUE (ProviderInvoiceId)
);

CREATE TABLE app.UsageCounters (
  BusinessId uniqueidentifier NOT NULL,
  Id uniqueidentifier NOT NULL DEFAULT NEWSEQUENTIALID(),
  FeatureCode nvarchar(60) NOT NULL,
  PeriodStartsAt datetime2(3) NOT NULL,
  PeriodEndsAt datetime2(3) NOT NULL,
  UsedQuantity bigint NOT NULL DEFAULT 0 CHECK (UsedQuantity>=0),
  CreatedAt datetime2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  UpdatedAt datetime2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  Version rowversion NOT NULL,
  PRIMARY KEY (BusinessId,Id),
  FOREIGN KEY (BusinessId) REFERENCES platform.Businesses(Id),
  UNIQUE (BusinessId,FeatureCode,PeriodStartsAt),
  CHECK (PeriodEndsAt>PeriodStartsAt)
);

CREATE TABLE app.Customers (
  BusinessId uniqueidentifier NOT NULL,
  Id uniqueidentifier NOT NULL DEFAULT NEWSEQUENTIALID(),
  Name nvarchar(200) NOT NULL,
  CompanyName nvarchar(200) NULL,
  Email nvarchar(254) NULL,
  Phone nvarchar(32) NULL,
  CustomerType varchar(32) NOT NULL DEFAULT 'Residential' CHECK (CustomerType IN ('Residential','Commercial')),
  ArchivedAt datetime2(3) NULL,
  CreatedAt datetime2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  UpdatedAt datetime2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  Version rowversion NOT NULL,
  PRIMARY KEY (BusinessId,Id),
  FOREIGN KEY (BusinessId) REFERENCES platform.Businesses(Id)
);

CREATE TABLE app.Locations (
  BusinessId uniqueidentifier NOT NULL,
  Id uniqueidentifier NOT NULL DEFAULT NEWSEQUENTIALID(),
  CustomerId uniqueidentifier NOT NULL,
  Label nvarchar(100) NOT NULL,
  AddressLine1 nvarchar(200) NOT NULL,
  AddressLine2 nvarchar(200) NULL,
  City nvarchar(100) NOT NULL,
  StateCode char(2) NOT NULL,
  PostalCode nvarchar(10) NOT NULL,
  CountryCode char(2) NOT NULL DEFAULT 'US',
  ArchivedAt datetime2(3) NULL,
  CreatedAt datetime2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  UpdatedAt datetime2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  Version rowversion NOT NULL,
  PRIMARY KEY (BusinessId,Id),
  FOREIGN KEY (BusinessId) REFERENCES platform.Businesses(Id),
  FOREIGN KEY (BusinessId,CustomerId) REFERENCES app.Customers(BusinessId,Id),
  UNIQUE (BusinessId,CustomerId,Id)
);

CREATE TABLE app.Assets (
  BusinessId uniqueidentifier NOT NULL,
  Id uniqueidentifier NOT NULL DEFAULT NEWSEQUENTIALID(),
  CustomerId uniqueidentifier NOT NULL,
  AssetType nvarchar(40) NOT NULL,
  Label nvarchar(200) NOT NULL,
  VinOrSerial nvarchar(100) NULL,
  Details nvarchar(max) NULL CHECK (ISJSON(Details)=1),
  ArchivedAt datetime2(3) NULL,
  CreatedAt datetime2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  UpdatedAt datetime2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  Version rowversion NOT NULL,
  PRIMARY KEY (BusinessId,Id),
  FOREIGN KEY (BusinessId) REFERENCES platform.Businesses(Id),
  FOREIGN KEY (BusinessId,CustomerId) REFERENCES app.Customers(BusinessId,Id),
  UNIQUE (BusinessId,CustomerId,Id)
);

CREATE TABLE app.CatalogItems (
  BusinessId uniqueidentifier NOT NULL,
  Id uniqueidentifier NOT NULL DEFAULT NEWSEQUENTIALID(),
  ItemType varchar(32) NOT NULL DEFAULT 'Service' CHECK (ItemType IN ('Service','Labor','Part')),
  Name nvarchar(200) NOT NULL,
  Unit nvarchar(32) NOT NULL,
  UnitCost decimal(19,2) NOT NULL DEFAULT 0 CHECK (UnitCost >= 0),
  UnitPrice decimal(19,4) NOT NULL DEFAULT 0 CHECK (UnitPrice>=0),
  TaxCategory nvarchar(80) NULL,
  ArchivedAt datetime2(3) NULL,
  CreatedAt datetime2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  UpdatedAt datetime2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  Version rowversion NOT NULL,
  PRIMARY KEY (BusinessId,Id),
  FOREIGN KEY (BusinessId) REFERENCES platform.Businesses(Id)
);

CREATE TABLE app.NumberSequences (
  BusinessId uniqueidentifier NOT NULL,
  Id uniqueidentifier NOT NULL DEFAULT NEWSEQUENTIALID(),
  DocumentType nvarchar(30) NOT NULL,
  NextValue bigint NOT NULL DEFAULT 1 CHECK (NextValue>0),
  Prefix nvarchar(30) NOT NULL,
  CreatedAt datetime2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  UpdatedAt datetime2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  Version rowversion NOT NULL,
  PRIMARY KEY (BusinessId,Id),
  FOREIGN KEY (BusinessId) REFERENCES platform.Businesses(Id),
  UNIQUE (BusinessId,DocumentType)
);

CREATE TABLE app.Jobs (
  BusinessId uniqueidentifier NOT NULL,
  Id uniqueidentifier NOT NULL DEFAULT NEWSEQUENTIALID(),
  CustomerId uniqueidentifier NOT NULL,
  LocationId uniqueidentifier NULL,
  AssetId uniqueidentifier NULL,
  JobNumber nvarchar(40) NOT NULL,
  Title nvarchar(200) NOT NULL,
  Description nvarchar(max) NULL,
  Status varchar(32) NOT NULL DEFAULT 'Draft' CHECK (Status IN ('Draft','Scheduled','InProgress','OnHold','Completed','Cancelled')),
  Priority varchar(32) NOT NULL DEFAULT 'Normal' CHECK (Priority IN ('Normal','High','Emergency')),
  CreatedByMemberId uniqueidentifier NOT NULL,
  IndustryDetails nvarchar(max) NULL CHECK (ISJSON(IndustryDetails)=1),
  CompletedAt datetime2(3) NULL,
  CancelledAt datetime2(3) NULL,
  CreatedAt datetime2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  UpdatedAt datetime2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  Version rowversion NOT NULL,
  PRIMARY KEY (BusinessId,Id),
  FOREIGN KEY (BusinessId) REFERENCES platform.Businesses(Id),
  FOREIGN KEY (BusinessId,CustomerId) REFERENCES app.Customers(BusinessId,Id),
  FOREIGN KEY (BusinessId,CustomerId,LocationId) REFERENCES app.Locations(BusinessId,CustomerId,Id),
  FOREIGN KEY (BusinessId,CustomerId,AssetId) REFERENCES app.Assets(BusinessId,CustomerId,Id),
  FOREIGN KEY (BusinessId,CreatedByMemberId) REFERENCES app.Members(BusinessId,Id),
  UNIQUE (BusinessId,JobNumber),
  UNIQUE (BusinessId,CustomerId,Id)
);

CREATE TABLE app.JobAssignments (
  BusinessId uniqueidentifier NOT NULL,
  Id uniqueidentifier NOT NULL DEFAULT NEWSEQUENTIALID(),
  JobId uniqueidentifier NOT NULL,
  MemberId uniqueidentifier NOT NULL,
  IsActive bit NOT NULL DEFAULT 1,
  CreatedAt datetime2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  UpdatedAt datetime2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  Version rowversion NOT NULL,
  PRIMARY KEY (BusinessId,Id),
  FOREIGN KEY (BusinessId) REFERENCES platform.Businesses(Id),
  FOREIGN KEY (BusinessId,JobId) REFERENCES app.Jobs(BusinessId,Id),
  FOREIGN KEY (BusinessId,MemberId) REFERENCES app.Members(BusinessId,Id),
  UNIQUE (BusinessId,JobId,MemberId)
);

CREATE TABLE app.Appointments (
  BusinessId uniqueidentifier NOT NULL,
  Id uniqueidentifier NOT NULL DEFAULT NEWSEQUENTIALID(),
  JobId uniqueidentifier NOT NULL,
  StartsAt datetime2(3) NOT NULL,
  EndsAt datetime2(3) NOT NULL,
  Status varchar(32) NOT NULL DEFAULT 'Scheduled' CHECK (Status IN ('Scheduled','Completed','Cancelled')),
  CreatedAt datetime2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  UpdatedAt datetime2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  Version rowversion NOT NULL,
  PRIMARY KEY (BusinessId,Id),
  FOREIGN KEY (BusinessId) REFERENCES platform.Businesses(Id),
  FOREIGN KEY (BusinessId,JobId) REFERENCES app.Jobs(BusinessId,Id),
  CHECK (EndsAt>StartsAt),
  UNIQUE (BusinessId,JobId,Id)
);

CREATE TABLE app.AppointmentStaff (
  BusinessId uniqueidentifier NOT NULL,
  Id uniqueidentifier NOT NULL DEFAULT NEWSEQUENTIALID(),
  JobId uniqueidentifier NOT NULL,
  AppointmentId uniqueidentifier NOT NULL,
  MemberId uniqueidentifier NOT NULL,
  CreatedAt datetime2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  UpdatedAt datetime2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  Version rowversion NOT NULL,
  PRIMARY KEY (BusinessId,Id),
  FOREIGN KEY (BusinessId) REFERENCES platform.Businesses(Id),
  FOREIGN KEY (BusinessId,JobId,AppointmentId) REFERENCES app.Appointments(BusinessId,JobId,Id),
  FOREIGN KEY (BusinessId,JobId,MemberId) REFERENCES app.JobAssignments(BusinessId,JobId,MemberId),
  UNIQUE (BusinessId,AppointmentId,MemberId)
);

CREATE TABLE app.JobItems (
  BusinessId uniqueidentifier NOT NULL,
  Id uniqueidentifier NOT NULL DEFAULT NEWSEQUENTIALID(),
  JobId uniqueidentifier NOT NULL,
  CatalogItemId uniqueidentifier NULL,
  ItemType varchar(32) NOT NULL DEFAULT 'Service' CHECK (ItemType IN ('Service','Labor','Part')),
  Description nvarchar(500) NOT NULL,
  Quantity decimal(12,3) NOT NULL CHECK (Quantity>0),
  Unit nvarchar(32) NOT NULL,
  UnitPrice decimal(19,4) NOT NULL CHECK (UnitPrice>=0),
  DiscountAmount decimal(19,2) NOT NULL DEFAULT 0 CHECK (DiscountAmount >= 0),
  TaxAmount decimal(19,2) NOT NULL DEFAULT 0 CHECK (TaxAmount >= 0),
  SortOrder int NOT NULL DEFAULT 0 CHECK (SortOrder>=0),
  CHECK (DiscountAmount <= ROUND(Quantity*UnitPrice,2)),
  LineTotal AS CONVERT(decimal(19,2),ROUND(Quantity*UnitPrice,2)-DiscountAmount+TaxAmount) PERSISTED,
  UnitCost decimal(19,2) NOT NULL DEFAULT 0 CHECK (UnitCost >= 0),
  CreatedAt datetime2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  UpdatedAt datetime2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  Version rowversion NOT NULL,
  PRIMARY KEY (BusinessId,Id),
  FOREIGN KEY (BusinessId) REFERENCES platform.Businesses(Id),
  FOREIGN KEY (BusinessId,JobId) REFERENCES app.Jobs(BusinessId,Id),
  FOREIGN KEY (BusinessId,CatalogItemId) REFERENCES app.CatalogItems(BusinessId,Id)
);

CREATE TABLE app.TimeEntries (
  BusinessId uniqueidentifier NOT NULL,
  Id uniqueidentifier NOT NULL DEFAULT NEWSEQUENTIALID(),
  JobId uniqueidentifier NOT NULL,
  MemberId uniqueidentifier NOT NULL,
  StartsAt datetime2(3) NOT NULL,
  EndsAt datetime2(3) NULL,
  CreatedAt datetime2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  UpdatedAt datetime2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  Version rowversion NOT NULL,
  PRIMARY KEY (BusinessId,Id),
  FOREIGN KEY (BusinessId) REFERENCES platform.Businesses(Id),
  FOREIGN KEY (BusinessId,JobId) REFERENCES app.Jobs(BusinessId,Id),
  FOREIGN KEY (BusinessId,MemberId) REFERENCES app.Members(BusinessId,Id),
  CHECK (EndsAt IS NULL OR EndsAt>StartsAt)
);

CREATE TABLE app.JobNotes (
  BusinessId uniqueidentifier NOT NULL,
  Id uniqueidentifier NOT NULL DEFAULT NEWSEQUENTIALID(),
  JobId uniqueidentifier NOT NULL,
  AuthorMemberId uniqueidentifier NOT NULL,
  Note nvarchar(max) NOT NULL,
  CreatedAt datetime2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  UpdatedAt datetime2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  Version rowversion NOT NULL,
  PRIMARY KEY (BusinessId,Id),
  FOREIGN KEY (BusinessId) REFERENCES platform.Businesses(Id),
  FOREIGN KEY (BusinessId,JobId) REFERENCES app.Jobs(BusinessId,Id),
  FOREIGN KEY (BusinessId,AuthorMemberId) REFERENCES app.Members(BusinessId,Id)
);

CREATE TABLE app.JobFiles (
  BusinessId uniqueidentifier NOT NULL,
  Id uniqueidentifier NOT NULL DEFAULT NEWSEQUENTIALID(),
  JobId uniqueidentifier NOT NULL,
  UploadedByMemberId uniqueidentifier NOT NULL,
  StorageKey nvarchar(450) NOT NULL,
  FileName nvarchar(255) NOT NULL,
  MimeType nvarchar(100) NOT NULL,
  SizeBytes bigint NOT NULL CHECK (SizeBytes>=0),
  Status varchar(32) NOT NULL DEFAULT 'Pending' CHECK (Status IN ('Pending','Scanning','Ready','Rejected')),
  CreatedAt datetime2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  UpdatedAt datetime2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  Version rowversion NOT NULL,
  PRIMARY KEY (BusinessId,Id),
  FOREIGN KEY (BusinessId) REFERENCES platform.Businesses(Id),
  FOREIGN KEY (BusinessId,JobId) REFERENCES app.Jobs(BusinessId,Id),
  FOREIGN KEY (BusinessId,UploadedByMemberId) REFERENCES app.Members(BusinessId,Id),
  UNIQUE (BusinessId,StorageKey)
);

CREATE TABLE app.JobChecklistItems (
  BusinessId uniqueidentifier NOT NULL,
  Id uniqueidentifier NOT NULL DEFAULT NEWSEQUENTIALID(),
  JobId uniqueidentifier NOT NULL,
  Label nvarchar(300) NOT NULL,
  IsRequired bit NOT NULL DEFAULT 0,
  IsCompleted bit NOT NULL DEFAULT 0,
  CompletedByMemberId uniqueidentifier NULL,
  CreatedAt datetime2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  UpdatedAt datetime2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  Version rowversion NOT NULL,
  PRIMARY KEY (BusinessId,Id),
  FOREIGN KEY (BusinessId) REFERENCES platform.Businesses(Id),
  FOREIGN KEY (BusinessId,JobId) REFERENCES app.Jobs(BusinessId,Id),
  FOREIGN KEY (BusinessId,CompletedByMemberId) REFERENCES app.Members(BusinessId,Id)
);

CREATE TABLE app.Estimates (
  BusinessId uniqueidentifier NOT NULL,
  Id uniqueidentifier NOT NULL DEFAULT NEWSEQUENTIALID(),
  JobId uniqueidentifier NOT NULL,
  EstimateNumber nvarchar(40) NOT NULL,
  Revision int NOT NULL DEFAULT 1 CHECK (Revision>0),
  Status varchar(32) NOT NULL DEFAULT 'Draft' CHECK (Status IN ('Draft','Sent','Approved','Declined','Expired','Superseded')),
  ValidUntil date NOT NULL,
  Currency char(3) NOT NULL DEFAULT 'USD',
  Subtotal decimal(19,2) NOT NULL DEFAULT 0 CHECK (Subtotal >= 0),
  DiscountTotal decimal(19,2) NOT NULL DEFAULT 0 CHECK (DiscountTotal >= 0),
  TaxTotal decimal(19,2) NOT NULL DEFAULT 0 CHECK (TaxTotal >= 0),
  Total decimal(19,2) NOT NULL DEFAULT 0 CHECK (Total >= 0),
  CustomerSnapshot nvarchar(max) NULL CHECK (ISJSON(CustomerSnapshot)=1),
  SentAt datetime2(3) NULL,
  CreatedAt datetime2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  UpdatedAt datetime2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  Version rowversion NOT NULL,
  PRIMARY KEY (BusinessId,Id),
  FOREIGN KEY (BusinessId) REFERENCES platform.Businesses(Id),
  FOREIGN KEY (BusinessId,JobId) REFERENCES app.Jobs(BusinessId,Id),
  UNIQUE (BusinessId,EstimateNumber,Revision),
  CHECK (Total=Subtotal-DiscountTotal+TaxTotal AND DiscountTotal<=Subtotal)
);

CREATE TABLE app.EstimateItems (
  BusinessId uniqueidentifier NOT NULL,
  Id uniqueidentifier NOT NULL DEFAULT NEWSEQUENTIALID(),
  EstimateId uniqueidentifier NOT NULL,
  ItemType varchar(32) NOT NULL DEFAULT 'Service' CHECK (ItemType IN ('Service','Labor','Part')),
  Description nvarchar(500) NOT NULL,
  Quantity decimal(12,3) NOT NULL CHECK (Quantity>0),
  Unit nvarchar(32) NOT NULL,
  UnitPrice decimal(19,4) NOT NULL CHECK (UnitPrice>=0),
  DiscountAmount decimal(19,2) NOT NULL DEFAULT 0 CHECK (DiscountAmount >= 0),
  TaxAmount decimal(19,2) NOT NULL DEFAULT 0 CHECK (TaxAmount >= 0),
  SortOrder int NOT NULL DEFAULT 0 CHECK (SortOrder>=0),
  CHECK (DiscountAmount <= ROUND(Quantity*UnitPrice,2)),
  LineTotal AS CONVERT(decimal(19,2),ROUND(Quantity*UnitPrice,2)-DiscountAmount+TaxAmount) PERSISTED,
  CreatedAt datetime2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  UpdatedAt datetime2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  Version rowversion NOT NULL,
  PRIMARY KEY (BusinessId,Id),
  FOREIGN KEY (BusinessId) REFERENCES platform.Businesses(Id),
  FOREIGN KEY (BusinessId,EstimateId) REFERENCES app.Estimates(BusinessId,Id)
);

CREATE TABLE app.EstimateDecisions (
  BusinessId uniqueidentifier NOT NULL,
  Id uniqueidentifier NOT NULL DEFAULT NEWSEQUENTIALID(),
  EstimateId uniqueidentifier NOT NULL,
  Decision varchar(32) NOT NULL DEFAULT 'Approved' CHECK (Decision IN ('Approved','Declined')),
  ApproverName nvarchar(200) NOT NULL,
  ApproverEmail nvarchar(254) NOT NULL,
  EvidenceReference nvarchar(450) NULL,
  DecidedAt datetime2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  CreatedAt datetime2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  UpdatedAt datetime2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  Version rowversion NOT NULL,
  PRIMARY KEY (BusinessId,Id),
  FOREIGN KEY (BusinessId) REFERENCES platform.Businesses(Id),
  FOREIGN KEY (BusinessId,EstimateId) REFERENCES app.Estimates(BusinessId,Id),
  UNIQUE (BusinessId,EstimateId)
);

CREATE TABLE app.PublicLinks (
  BusinessId uniqueidentifier NOT NULL,
  Id uniqueidentifier NOT NULL DEFAULT NEWSEQUENTIALID(),
  EstimateId uniqueidentifier NOT NULL,
  TokenHash binary(32) NOT NULL,
  ExpiresAt datetime2(3) NOT NULL,
  ConsumedAt datetime2(3) NULL,
  RevokedAt datetime2(3) NULL,
  CreatedAt datetime2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  UpdatedAt datetime2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  Version rowversion NOT NULL,
  PRIMARY KEY (BusinessId,Id),
  FOREIGN KEY (BusinessId) REFERENCES platform.Businesses(Id),
  FOREIGN KEY (BusinessId,EstimateId) REFERENCES app.Estimates(BusinessId,Id),
  UNIQUE (TokenHash)
);

CREATE TABLE app.Invoices (
  BusinessId uniqueidentifier NOT NULL,
  Id uniqueidentifier NOT NULL DEFAULT NEWSEQUENTIALID(),
  JobId uniqueidentifier NOT NULL,
  CustomerId uniqueidentifier NOT NULL,
  InvoiceNumber nvarchar(40) NOT NULL,
  Status varchar(32) NOT NULL DEFAULT 'Draft' CHECK (Status IN ('Draft','Issued','Voided')),
  DeliveryStatus varchar(32) NOT NULL DEFAULT 'NotSent' CHECK (DeliveryStatus IN ('NotSent','Queued','Sent','Failed')),
  IssuedOn date NULL,
  DueOn date NULL,
  Currency char(3) NOT NULL DEFAULT 'USD',
  Subtotal decimal(19,2) NOT NULL DEFAULT 0 CHECK (Subtotal >= 0),
  DiscountTotal decimal(19,2) NOT NULL DEFAULT 0 CHECK (DiscountTotal >= 0),
  TaxTotal decimal(19,2) NOT NULL DEFAULT 0 CHECK (TaxTotal >= 0),
  Total decimal(19,2) NOT NULL DEFAULT 0 CHECK (Total >= 0),
  BillingSnapshot nvarchar(max) NULL CHECK (ISJSON(BillingSnapshot)=1),
  VoidReason nvarchar(500) NULL,
  CreatedAt datetime2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  UpdatedAt datetime2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  Version rowversion NOT NULL,
  PRIMARY KEY (BusinessId,Id),
  FOREIGN KEY (BusinessId) REFERENCES platform.Businesses(Id),
  FOREIGN KEY (BusinessId,CustomerId,JobId) REFERENCES app.Jobs(BusinessId,CustomerId,Id),
  UNIQUE (BusinessId,InvoiceNumber),
  CHECK (Total=Subtotal-DiscountTotal+TaxTotal AND DiscountTotal<=Subtotal),
  CHECK (Status='Draft' OR (IssuedOn IS NOT NULL AND DueOn IS NOT NULL AND DueOn>=IssuedOn AND BillingSnapshot IS NOT NULL))
);

CREATE TABLE app.InvoiceItems (
  BusinessId uniqueidentifier NOT NULL,
  Id uniqueidentifier NOT NULL DEFAULT NEWSEQUENTIALID(),
  InvoiceId uniqueidentifier NOT NULL,
  ItemType varchar(32) NOT NULL DEFAULT 'Service' CHECK (ItemType IN ('Service','Labor','Part')),
  Description nvarchar(500) NOT NULL,
  Quantity decimal(12,3) NOT NULL CHECK (Quantity>0),
  Unit nvarchar(32) NOT NULL,
  UnitPrice decimal(19,4) NOT NULL CHECK (UnitPrice>=0),
  DiscountAmount decimal(19,2) NOT NULL DEFAULT 0 CHECK (DiscountAmount >= 0),
  TaxAmount decimal(19,2) NOT NULL DEFAULT 0 CHECK (TaxAmount >= 0),
  SortOrder int NOT NULL DEFAULT 0 CHECK (SortOrder>=0),
  CHECK (DiscountAmount <= ROUND(Quantity*UnitPrice,2)),
  LineTotal AS CONVERT(decimal(19,2),ROUND(Quantity*UnitPrice,2)-DiscountAmount+TaxAmount) PERSISTED,
  CreatedAt datetime2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  UpdatedAt datetime2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  Version rowversion NOT NULL,
  PRIMARY KEY (BusinessId,Id),
  FOREIGN KEY (BusinessId) REFERENCES platform.Businesses(Id),
  FOREIGN KEY (BusinessId,InvoiceId) REFERENCES app.Invoices(BusinessId,Id)
);

CREATE TABLE app.Payments (
  BusinessId uniqueidentifier NOT NULL,
  Id uniqueidentifier NOT NULL DEFAULT NEWSEQUENTIALID(),
  InvoiceId uniqueidentifier NOT NULL,
  Amount decimal(19,2) NOT NULL CHECK (Amount>0),
  Method varchar(32) NOT NULL DEFAULT 'Cash' CHECK (Method IN ('Cash','Check','BankTransfer','Card')),
  Status varchar(32) NOT NULL DEFAULT 'Pending' CHECK (Status IN ('Pending','Succeeded','Failed')),
  ExternalReference nvarchar(200) NULL,
  PaidAt datetime2(3) NULL,
  RecordedByMemberId uniqueidentifier NOT NULL,
  CreatedAt datetime2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  UpdatedAt datetime2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  Version rowversion NOT NULL,
  PRIMARY KEY (BusinessId,Id),
  FOREIGN KEY (BusinessId) REFERENCES platform.Businesses(Id),
  FOREIGN KEY (BusinessId,InvoiceId) REFERENCES app.Invoices(BusinessId,Id),
  FOREIGN KEY (BusinessId,RecordedByMemberId) REFERENCES app.Members(BusinessId,Id)
);

CREATE TABLE app.PaymentRefunds (
  BusinessId uniqueidentifier NOT NULL,
  Id uniqueidentifier NOT NULL DEFAULT NEWSEQUENTIALID(),
  PaymentId uniqueidentifier NOT NULL,
  Amount decimal(19,2) NOT NULL CHECK (Amount>0),
  Status varchar(32) NOT NULL DEFAULT 'Pending' CHECK (Status IN ('Pending','Succeeded','Failed')),
  Reason nvarchar(500) NOT NULL,
  ExternalReference nvarchar(200) NULL,
  CreatedAt datetime2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  UpdatedAt datetime2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  Version rowversion NOT NULL,
  PRIMARY KEY (BusinessId,Id),
  FOREIGN KEY (BusinessId) REFERENCES platform.Businesses(Id),
  FOREIGN KEY (BusinessId,PaymentId) REFERENCES app.Payments(BusinessId,Id)
);

CREATE TABLE app.CreditNotes (
  BusinessId uniqueidentifier NOT NULL,
  Id uniqueidentifier NOT NULL DEFAULT NEWSEQUENTIALID(),
  InvoiceId uniqueidentifier NOT NULL,
  CreditNumber nvarchar(40) NOT NULL,
  Amount decimal(19,2) NOT NULL CHECK (Amount>0),
  Reason nvarchar(500) NOT NULL,
  CreatedByMemberId uniqueidentifier NOT NULL,
  CreatedAt datetime2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  UpdatedAt datetime2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  Version rowversion NOT NULL,
  PRIMARY KEY (BusinessId,Id),
  FOREIGN KEY (BusinessId) REFERENCES platform.Businesses(Id),
  FOREIGN KEY (BusinessId,InvoiceId) REFERENCES app.Invoices(BusinessId,Id),
  FOREIGN KEY (BusinessId,CreatedByMemberId) REFERENCES app.Members(BusinessId,Id),
  UNIQUE (BusinessId,CreditNumber)
);

CREATE TABLE app.ExportRequests (
  BusinessId uniqueidentifier NOT NULL,
  Id uniqueidentifier NOT NULL DEFAULT NEWSEQUENTIALID(),
  RequestedByMemberId uniqueidentifier NOT NULL,
  ExportType varchar(32) NOT NULL DEFAULT 'FullBusiness' CHECK (ExportType IN ('Customers','Jobs','Invoices','FullBusiness')),
  Status varchar(32) NOT NULL DEFAULT 'Queued' CHECK (Status IN ('Queued','Running','Ready','Failed','Expired')),
  Filters nvarchar(max) NULL CHECK (ISJSON(Filters)=1),
  StorageKey nvarchar(450) NULL,
  ExpiresAt datetime2(3) NULL,
  CreatedAt datetime2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  UpdatedAt datetime2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  Version rowversion NOT NULL,
  PRIMARY KEY (BusinessId,Id),
  FOREIGN KEY (BusinessId) REFERENCES platform.Businesses(Id),
  FOREIGN KEY (BusinessId,RequestedByMemberId) REFERENCES app.Members(BusinessId,Id)
);

CREATE TABLE app.AuditEvents (
  BusinessId uniqueidentifier NOT NULL,
  Id uniqueidentifier NOT NULL DEFAULT NEWSEQUENTIALID(),
  ActorUserId uniqueidentifier NULL,
  Action nvarchar(100) NOT NULL,
  EntityType nvarchar(80) NOT NULL,
  EntityId uniqueidentifier NULL,
  CorrelationId nvarchar(100) NOT NULL,
  Changes nvarchar(max) NULL CHECK (ISJSON(Changes)=1),
  CreatedAt datetime2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  UpdatedAt datetime2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  Version rowversion NOT NULL,
  PRIMARY KEY (BusinessId,Id),
  FOREIGN KEY (BusinessId) REFERENCES platform.Businesses(Id),
  FOREIGN KEY (ActorUserId) REFERENCES auth.Users(Id)
);

CREATE TABLE app.Operations (
  BusinessId uniqueidentifier NOT NULL,
  Id uniqueidentifier NOT NULL DEFAULT NEWSEQUENTIALID(),
  RequestedByMemberId uniqueidentifier NULL,
  Kind nvarchar(80) NOT NULL,
  Status varchar(32) NOT NULL DEFAULT 'Queued' CHECK (Status IN ('Queued','Running','Ready','Failed')),
  ResultReference nvarchar(450) NULL,
  FailureCode nvarchar(100) NULL,
  CreatedAt datetime2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  UpdatedAt datetime2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  Version rowversion NOT NULL,
  PRIMARY KEY (BusinessId,Id),
  FOREIGN KEY (BusinessId) REFERENCES platform.Businesses(Id),
  FOREIGN KEY (BusinessId,RequestedByMemberId) REFERENCES app.Members(BusinessId,Id)
);

CREATE TABLE app.OutboxMessages (
  BusinessId uniqueidentifier NOT NULL,
  Id uniqueidentifier NOT NULL DEFAULT NEWSEQUENTIALID(),
  EventType nvarchar(100) NOT NULL,
  Payload nvarchar(max) NOT NULL CHECK (ISJSON(Payload)=1),
  ProcessedAt datetime2(3) NULL,
  Attempts int NOT NULL DEFAULT 0,
  NextAttemptAt datetime2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  CreatedAt datetime2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  UpdatedAt datetime2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  Version rowversion NOT NULL,
  PRIMARY KEY (BusinessId,Id),
  FOREIGN KEY (BusinessId) REFERENCES platform.Businesses(Id)
);

CREATE TABLE app.EmailConfigurations (
  BusinessId uniqueidentifier NOT NULL,
  Host nvarchar(200) NOT NULL,
  Port int NOT NULL DEFAULT 587,
  Username nvarchar(200) NOT NULL,
  Password nvarchar(500) NOT NULL,
  FromEmail nvarchar(254) NOT NULL,
  FromName nvarchar(200) NOT NULL,
  EnableSsl bit NOT NULL DEFAULT 1,
  IsEnabled bit NOT NULL DEFAULT 0,
  UpdatedAt datetime2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  PRIMARY KEY (BusinessId),
  FOREIGN KEY (BusinessId) REFERENCES platform.Businesses(Id)
);

CREATE TABLE app.IdempotencyRecords (
  BusinessId uniqueidentifier NOT NULL,
  Id uniqueidentifier NOT NULL DEFAULT NEWSEQUENTIALID(),
  ActorUserId uniqueidentifier NOT NULL,
  Operation nvarchar(120) NOT NULL,
  IdempotencyKey nvarchar(100) NOT NULL,
  RequestHash binary(32) NOT NULL,
  Status varchar(32) NOT NULL DEFAULT 'InProgress' CHECK (Status IN ('InProgress','Completed')),
  ResponseCode int NULL,
  ResponseJson nvarchar(max) NULL,
  ExpiresAt datetime2(3) NOT NULL,
  CreatedAt datetime2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  UpdatedAt datetime2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  Version rowversion NOT NULL,
  PRIMARY KEY (BusinessId,Id),
  FOREIGN KEY (BusinessId) REFERENCES platform.Businesses(Id),
  FOREIGN KEY (ActorUserId) REFERENCES auth.Users(Id),
  UNIQUE (BusinessId,ActorUserId,Operation,IdempotencyKey)
);

CREATE TABLE platform.WebhookEvents (
  Id uniqueidentifier NOT NULL DEFAULT NEWSEQUENTIALID(),
  Provider nvarchar(40) NOT NULL,
  ProviderEventId nvarchar(200) NOT NULL,
  BusinessId uniqueidentifier NULL,
  PayloadHash binary(32) NOT NULL,
  Status varchar(32) NOT NULL DEFAULT 'Received' CHECK (Status IN ('Received','Processed','Failed')),
  ReceivedAt datetime2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  ProcessedAt datetime2(3) NULL,
  PRIMARY KEY (Id),
  UNIQUE (Provider,ProviderEventId),
  FOREIGN KEY (BusinessId) REFERENCES platform.Businesses(Id)
);

CREATE TABLE platform.Administrators (
  UserId uniqueidentifier NOT NULL,
  RoleCode varchar(32) NOT NULL DEFAULT 'Support' CHECK (RoleCode IN ('Support','BillingAdmin','OperationsAdmin')),
  IsActive bit NOT NULL DEFAULT 1,
  PRIMARY KEY (UserId),
  FOREIGN KEY (UserId) REFERENCES auth.Users(Id)
);

CREATE TABLE app.SupportAccessGrants (
  BusinessId uniqueidentifier NOT NULL,
  Id uniqueidentifier NOT NULL DEFAULT NEWSEQUENTIALID(),
  AdminUserId uniqueidentifier NOT NULL,
  ApprovedByMemberId uniqueidentifier NOT NULL,
  Scope varchar(32) NOT NULL DEFAULT 'ReadOnly' CHECK (Scope IN ('ReadOnly')),
  ExpiresAt datetime2(3) NOT NULL,
  RevokedAt datetime2(3) NULL,
  CreatedAt datetime2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  UpdatedAt datetime2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  Version rowversion NOT NULL,
  PRIMARY KEY (BusinessId,Id),
  FOREIGN KEY (BusinessId) REFERENCES platform.Businesses(Id),
  FOREIGN KEY (AdminUserId) REFERENCES platform.Administrators(UserId),
  FOREIGN KEY (BusinessId,ApprovedByMemberId) REFERENCES app.Members(BusinessId,Id)
);

CREATE TABLE platform.AdminAuditEvents (
  Id uniqueidentifier NOT NULL DEFAULT NEWSEQUENTIALID(),
  ActorUserId uniqueidentifier NOT NULL,
  BusinessId uniqueidentifier NULL,
  Action nvarchar(100) NOT NULL,
  Details nvarchar(max) NULL CHECK (ISJSON(Details)=1),
  CreatedAt datetime2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
  PRIMARY KEY (Id),
  FOREIGN KEY (ActorUserId) REFERENCES auth.Users(Id),
  FOREIGN KEY (BusinessId) REFERENCES platform.Businesses(Id)
);

CREATE TABLE platform.BackupRuns (
  Id uniqueidentifier NOT NULL DEFAULT NEWSEQUENTIALID(),
  ProviderReference nvarchar(450) NOT NULL,
  Status varchar(32) NOT NULL DEFAULT 'Running' CHECK (Status IN ('Running','Succeeded','Failed')),
  StartedAt datetime2(3) NOT NULL,
  CompletedAt datetime2(3) NULL,
  PRIMARY KEY (Id)
);

CREATE TABLE platform.RestoreRuns (
  Id uniqueidentifier NOT NULL DEFAULT NEWSEQUENTIALID(),
  BackupRunId uniqueidentifier NOT NULL,
  RequestedByUserId uniqueidentifier NOT NULL,
  TargetEnvironment nvarchar(100) NOT NULL,
  Status varchar(32) NOT NULL DEFAULT 'Running' CHECK (Status IN ('Running','Succeeded','Failed')),
  StartedAt datetime2(3) NOT NULL,
  CompletedAt datetime2(3) NULL,
  PRIMARY KEY (Id),
  FOREIGN KEY (BackupRunId) REFERENCES platform.BackupRuns(Id),
  FOREIGN KEY (RequestedByUserId) REFERENCES auth.Users(Id)
);

CREATE UNIQUE INDEX UX_Invitations_PendingEmail ON app.Invitations(BusinessId,NormalizedEmail) WHERE Status='Pending';
CREATE UNIQUE INDEX UX_Subscriptions_Current ON app.Subscriptions(BusinessId) WHERE IsCurrent=1;
CREATE UNIQUE INDEX UX_Subscriptions_Provider ON app.Subscriptions(ProviderSubscriptionId) WHERE ProviderSubscriptionId IS NOT NULL;
CREATE UNIQUE INDEX UX_Payments_External ON app.Payments(BusinessId,ExternalReference) WHERE ExternalReference IS NOT NULL;
CREATE UNIQUE INDEX UX_Invoices_OneLivePerJob ON app.Invoices(BusinessId,JobId) WHERE Status<>'Voided';
CREATE INDEX IX_Jobs_Status ON app.Jobs(BusinessId,Status,CreatedAt);
CREATE INDEX IX_Jobs_Customer ON app.Jobs(BusinessId,CustomerId,CreatedAt);
CREATE INDEX IX_JobAssignments_Member ON app.JobAssignments(BusinessId,MemberId,IsActive);
CREATE INDEX IX_Appointments_Start ON app.Appointments(BusinessId,StartsAt);
CREATE INDEX IX_Invoices_CustomerDue ON app.Invoices(BusinessId,CustomerId,DueOn);
CREATE INDEX IX_AuditEvents_Time ON app.AuditEvents(BusinessId,CreatedAt);
CREATE INDEX IX_Outbox_Pending ON app.OutboxMessages(BusinessId,NextAttemptAt) WHERE ProcessedAt IS NULL;
COMMIT;
GO
