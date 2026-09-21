-- Apply AFTER 01-schema.sql. Missing/wrong session context denies tenant access.
use ServiceDeskDev;
GO
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO
CREATE FUNCTION security.TenantPredicate(@BusinessId uniqueidentifier)
RETURNS TABLE WITH SCHEMABINDING
AS RETURN SELECT 1 AS Allowed
WHERE @BusinessId = TRY_CONVERT(uniqueidentifier,SESSION_CONTEXT(N'BusinessId'))
   OR TRY_CONVERT(int,SESSION_CONTEXT(N'IsPlatformAdmin')) = 1;
GO
CREATE SECURITY POLICY security.MembersTenantPolicy
ADD FILTER PREDICATE security.TenantPredicate(BusinessId) ON app.Members,
ADD BLOCK PREDICATE security.TenantPredicate(BusinessId) ON app.Members AFTER INSERT,
ADD BLOCK PREDICATE security.TenantPredicate(BusinessId) ON app.Members AFTER UPDATE
WITH (STATE=ON,SCHEMABINDING=ON);
GO
CREATE SECURITY POLICY security.InvitationsTenantPolicy
ADD FILTER PREDICATE security.TenantPredicate(BusinessId) ON app.Invitations,
ADD BLOCK PREDICATE security.TenantPredicate(BusinessId) ON app.Invitations AFTER INSERT,
ADD BLOCK PREDICATE security.TenantPredicate(BusinessId) ON app.Invitations AFTER UPDATE
WITH (STATE=ON,SCHEMABINDING=ON);
GO
CREATE SECURITY POLICY security.SubscriptionsTenantPolicy
ADD FILTER PREDICATE security.TenantPredicate(BusinessId) ON app.Subscriptions,
ADD BLOCK PREDICATE security.TenantPredicate(BusinessId) ON app.Subscriptions AFTER INSERT,
ADD BLOCK PREDICATE security.TenantPredicate(BusinessId) ON app.Subscriptions AFTER UPDATE
WITH (STATE=ON,SCHEMABINDING=ON);
GO
CREATE SECURITY POLICY security.PlanChangesTenantPolicy
ADD FILTER PREDICATE security.TenantPredicate(BusinessId) ON app.PlanChanges,
ADD BLOCK PREDICATE security.TenantPredicate(BusinessId) ON app.PlanChanges AFTER INSERT,
ADD BLOCK PREDICATE security.TenantPredicate(BusinessId) ON app.PlanChanges AFTER UPDATE
WITH (STATE=ON,SCHEMABINDING=ON);
GO
CREATE SECURITY POLICY security.SubscriptionInvoicesTenantPolicy
ADD FILTER PREDICATE security.TenantPredicate(BusinessId) ON app.SubscriptionInvoices,
ADD BLOCK PREDICATE security.TenantPredicate(BusinessId) ON app.SubscriptionInvoices AFTER INSERT,
ADD BLOCK PREDICATE security.TenantPredicate(BusinessId) ON app.SubscriptionInvoices AFTER UPDATE
WITH (STATE=ON,SCHEMABINDING=ON);
GO
CREATE SECURITY POLICY security.UsageCountersTenantPolicy
ADD FILTER PREDICATE security.TenantPredicate(BusinessId) ON app.UsageCounters,
ADD BLOCK PREDICATE security.TenantPredicate(BusinessId) ON app.UsageCounters AFTER INSERT,
ADD BLOCK PREDICATE security.TenantPredicate(BusinessId) ON app.UsageCounters AFTER UPDATE
WITH (STATE=ON,SCHEMABINDING=ON);
GO
CREATE SECURITY POLICY security.CustomersTenantPolicy
ADD FILTER PREDICATE security.TenantPredicate(BusinessId) ON app.Customers,
ADD BLOCK PREDICATE security.TenantPredicate(BusinessId) ON app.Customers AFTER INSERT,
ADD BLOCK PREDICATE security.TenantPredicate(BusinessId) ON app.Customers AFTER UPDATE
WITH (STATE=ON,SCHEMABINDING=ON);
GO
CREATE SECURITY POLICY security.LocationsTenantPolicy
ADD FILTER PREDICATE security.TenantPredicate(BusinessId) ON app.Locations,
ADD BLOCK PREDICATE security.TenantPredicate(BusinessId) ON app.Locations AFTER INSERT,
ADD BLOCK PREDICATE security.TenantPredicate(BusinessId) ON app.Locations AFTER UPDATE
WITH (STATE=ON,SCHEMABINDING=ON);
GO
CREATE SECURITY POLICY security.AssetsTenantPolicy
ADD FILTER PREDICATE security.TenantPredicate(BusinessId) ON app.Assets,
ADD BLOCK PREDICATE security.TenantPredicate(BusinessId) ON app.Assets AFTER INSERT,
ADD BLOCK PREDICATE security.TenantPredicate(BusinessId) ON app.Assets AFTER UPDATE
WITH (STATE=ON,SCHEMABINDING=ON);
GO
CREATE SECURITY POLICY security.CatalogItemsTenantPolicy
ADD FILTER PREDICATE security.TenantPredicate(BusinessId) ON app.CatalogItems,
ADD BLOCK PREDICATE security.TenantPredicate(BusinessId) ON app.CatalogItems AFTER INSERT,
ADD BLOCK PREDICATE security.TenantPredicate(BusinessId) ON app.CatalogItems AFTER UPDATE
WITH (STATE=ON,SCHEMABINDING=ON);
GO
CREATE SECURITY POLICY security.NumberSequencesTenantPolicy
ADD FILTER PREDICATE security.TenantPredicate(BusinessId) ON app.NumberSequences,
ADD BLOCK PREDICATE security.TenantPredicate(BusinessId) ON app.NumberSequences AFTER INSERT,
ADD BLOCK PREDICATE security.TenantPredicate(BusinessId) ON app.NumberSequences AFTER UPDATE
WITH (STATE=ON,SCHEMABINDING=ON);
GO
CREATE SECURITY POLICY security.JobsTenantPolicy
ADD FILTER PREDICATE security.TenantPredicate(BusinessId) ON app.Jobs,
ADD BLOCK PREDICATE security.TenantPredicate(BusinessId) ON app.Jobs AFTER INSERT,
ADD BLOCK PREDICATE security.TenantPredicate(BusinessId) ON app.Jobs AFTER UPDATE
WITH (STATE=ON,SCHEMABINDING=ON);
GO
CREATE SECURITY POLICY security.JobAssignmentsTenantPolicy
ADD FILTER PREDICATE security.TenantPredicate(BusinessId) ON app.JobAssignments,
ADD BLOCK PREDICATE security.TenantPredicate(BusinessId) ON app.JobAssignments AFTER INSERT,
ADD BLOCK PREDICATE security.TenantPredicate(BusinessId) ON app.JobAssignments AFTER UPDATE
WITH (STATE=ON,SCHEMABINDING=ON);
GO
CREATE SECURITY POLICY security.AppointmentsTenantPolicy
ADD FILTER PREDICATE security.TenantPredicate(BusinessId) ON app.Appointments,
ADD BLOCK PREDICATE security.TenantPredicate(BusinessId) ON app.Appointments AFTER INSERT,
ADD BLOCK PREDICATE security.TenantPredicate(BusinessId) ON app.Appointments AFTER UPDATE
WITH (STATE=ON,SCHEMABINDING=ON);
GO
CREATE SECURITY POLICY security.AppointmentStaffTenantPolicy
ADD FILTER PREDICATE security.TenantPredicate(BusinessId) ON app.AppointmentStaff,
ADD BLOCK PREDICATE security.TenantPredicate(BusinessId) ON app.AppointmentStaff AFTER INSERT,
ADD BLOCK PREDICATE security.TenantPredicate(BusinessId) ON app.AppointmentStaff AFTER UPDATE
WITH (STATE=ON,SCHEMABINDING=ON);
GO
CREATE SECURITY POLICY security.JobItemsTenantPolicy
ADD FILTER PREDICATE security.TenantPredicate(BusinessId) ON app.JobItems,
ADD BLOCK PREDICATE security.TenantPredicate(BusinessId) ON app.JobItems AFTER INSERT,
ADD BLOCK PREDICATE security.TenantPredicate(BusinessId) ON app.JobItems AFTER UPDATE
WITH (STATE=ON,SCHEMABINDING=ON);
GO
CREATE SECURITY POLICY security.TimeEntriesTenantPolicy
ADD FILTER PREDICATE security.TenantPredicate(BusinessId) ON app.TimeEntries,
ADD BLOCK PREDICATE security.TenantPredicate(BusinessId) ON app.TimeEntries AFTER INSERT,
ADD BLOCK PREDICATE security.TenantPredicate(BusinessId) ON app.TimeEntries AFTER UPDATE
WITH (STATE=ON,SCHEMABINDING=ON);
GO
CREATE SECURITY POLICY security.JobNotesTenantPolicy
ADD FILTER PREDICATE security.TenantPredicate(BusinessId) ON app.JobNotes,
ADD BLOCK PREDICATE security.TenantPredicate(BusinessId) ON app.JobNotes AFTER INSERT,
ADD BLOCK PREDICATE security.TenantPredicate(BusinessId) ON app.JobNotes AFTER UPDATE
WITH (STATE=ON,SCHEMABINDING=ON);
GO
CREATE SECURITY POLICY security.JobFilesTenantPolicy
ADD FILTER PREDICATE security.TenantPredicate(BusinessId) ON app.JobFiles,
ADD BLOCK PREDICATE security.TenantPredicate(BusinessId) ON app.JobFiles AFTER INSERT,
ADD BLOCK PREDICATE security.TenantPredicate(BusinessId) ON app.JobFiles AFTER UPDATE
WITH (STATE=ON,SCHEMABINDING=ON);
GO
CREATE SECURITY POLICY security.JobChecklistItemsTenantPolicy
ADD FILTER PREDICATE security.TenantPredicate(BusinessId) ON app.JobChecklistItems,
ADD BLOCK PREDICATE security.TenantPredicate(BusinessId) ON app.JobChecklistItems AFTER INSERT,
ADD BLOCK PREDICATE security.TenantPredicate(BusinessId) ON app.JobChecklistItems AFTER UPDATE
WITH (STATE=ON,SCHEMABINDING=ON);
GO
CREATE SECURITY POLICY security.EstimatesTenantPolicy
ADD FILTER PREDICATE security.TenantPredicate(BusinessId) ON app.Estimates,
ADD BLOCK PREDICATE security.TenantPredicate(BusinessId) ON app.Estimates AFTER INSERT,
ADD BLOCK PREDICATE security.TenantPredicate(BusinessId) ON app.Estimates AFTER UPDATE
WITH (STATE=ON,SCHEMABINDING=ON);
GO
CREATE SECURITY POLICY security.EstimateItemsTenantPolicy
ADD FILTER PREDICATE security.TenantPredicate(BusinessId) ON app.EstimateItems,
ADD BLOCK PREDICATE security.TenantPredicate(BusinessId) ON app.EstimateItems AFTER INSERT,
ADD BLOCK PREDICATE security.TenantPredicate(BusinessId) ON app.EstimateItems AFTER UPDATE
WITH (STATE=ON,SCHEMABINDING=ON);
GO
CREATE SECURITY POLICY security.EstimateDecisionsTenantPolicy
ADD FILTER PREDICATE security.TenantPredicate(BusinessId) ON app.EstimateDecisions,
ADD BLOCK PREDICATE security.TenantPredicate(BusinessId) ON app.EstimateDecisions AFTER INSERT,
ADD BLOCK PREDICATE security.TenantPredicate(BusinessId) ON app.EstimateDecisions AFTER UPDATE
WITH (STATE=ON,SCHEMABINDING=ON);
GO
CREATE SECURITY POLICY security.PublicLinksTenantPolicy
ADD FILTER PREDICATE security.TenantPredicate(BusinessId) ON app.PublicLinks,
ADD BLOCK PREDICATE security.TenantPredicate(BusinessId) ON app.PublicLinks AFTER INSERT,
ADD BLOCK PREDICATE security.TenantPredicate(BusinessId) ON app.PublicLinks AFTER UPDATE
WITH (STATE=ON,SCHEMABINDING=ON);
GO
CREATE SECURITY POLICY security.InvoicesTenantPolicy
ADD FILTER PREDICATE security.TenantPredicate(BusinessId) ON app.Invoices,
ADD BLOCK PREDICATE security.TenantPredicate(BusinessId) ON app.Invoices AFTER INSERT,
ADD BLOCK PREDICATE security.TenantPredicate(BusinessId) ON app.Invoices AFTER UPDATE
WITH (STATE=ON,SCHEMABINDING=ON);
GO
CREATE SECURITY POLICY security.InvoiceItemsTenantPolicy
ADD FILTER PREDICATE security.TenantPredicate(BusinessId) ON app.InvoiceItems,
ADD BLOCK PREDICATE security.TenantPredicate(BusinessId) ON app.InvoiceItems AFTER INSERT,
ADD BLOCK PREDICATE security.TenantPredicate(BusinessId) ON app.InvoiceItems AFTER UPDATE
WITH (STATE=ON,SCHEMABINDING=ON);
GO
CREATE SECURITY POLICY security.PaymentsTenantPolicy
ADD FILTER PREDICATE security.TenantPredicate(BusinessId) ON app.Payments,
ADD BLOCK PREDICATE security.TenantPredicate(BusinessId) ON app.Payments AFTER INSERT,
ADD BLOCK PREDICATE security.TenantPredicate(BusinessId) ON app.Payments AFTER UPDATE
WITH (STATE=ON,SCHEMABINDING=ON);
GO
CREATE SECURITY POLICY security.PaymentRefundsTenantPolicy
ADD FILTER PREDICATE security.TenantPredicate(BusinessId) ON app.PaymentRefunds,
ADD BLOCK PREDICATE security.TenantPredicate(BusinessId) ON app.PaymentRefunds AFTER INSERT,
ADD BLOCK PREDICATE security.TenantPredicate(BusinessId) ON app.PaymentRefunds AFTER UPDATE
WITH (STATE=ON,SCHEMABINDING=ON);
GO
CREATE SECURITY POLICY security.CreditNotesTenantPolicy
ADD FILTER PREDICATE security.TenantPredicate(BusinessId) ON app.CreditNotes,
ADD BLOCK PREDICATE security.TenantPredicate(BusinessId) ON app.CreditNotes AFTER INSERT,
ADD BLOCK PREDICATE security.TenantPredicate(BusinessId) ON app.CreditNotes AFTER UPDATE
WITH (STATE=ON,SCHEMABINDING=ON);
GO
CREATE SECURITY POLICY security.ExportRequestsTenantPolicy
ADD FILTER PREDICATE security.TenantPredicate(BusinessId) ON app.ExportRequests,
ADD BLOCK PREDICATE security.TenantPredicate(BusinessId) ON app.ExportRequests AFTER INSERT,
ADD BLOCK PREDICATE security.TenantPredicate(BusinessId) ON app.ExportRequests AFTER UPDATE
WITH (STATE=ON,SCHEMABINDING=ON);
GO
CREATE SECURITY POLICY security.AuditEventsTenantPolicy
ADD FILTER PREDICATE security.TenantPredicate(BusinessId) ON app.AuditEvents,
ADD BLOCK PREDICATE security.TenantPredicate(BusinessId) ON app.AuditEvents AFTER INSERT,
ADD BLOCK PREDICATE security.TenantPredicate(BusinessId) ON app.AuditEvents AFTER UPDATE
WITH (STATE=ON,SCHEMABINDING=ON);
GO
CREATE SECURITY POLICY security.OperationsTenantPolicy
ADD FILTER PREDICATE security.TenantPredicate(BusinessId) ON app.Operations,
ADD BLOCK PREDICATE security.TenantPredicate(BusinessId) ON app.Operations AFTER INSERT,
ADD BLOCK PREDICATE security.TenantPredicate(BusinessId) ON app.Operations AFTER UPDATE
WITH (STATE=ON,SCHEMABINDING=ON);
GO
CREATE SECURITY POLICY security.OutboxMessagesTenantPolicy
ADD FILTER PREDICATE security.TenantPredicate(BusinessId) ON app.OutboxMessages,
ADD BLOCK PREDICATE security.TenantPredicate(BusinessId) ON app.OutboxMessages AFTER INSERT,
ADD BLOCK PREDICATE security.TenantPredicate(BusinessId) ON app.OutboxMessages AFTER UPDATE
WITH (STATE=ON,SCHEMABINDING=ON);
GO
CREATE SECURITY POLICY security.IdempotencyRecordsTenantPolicy
ADD FILTER PREDICATE security.TenantPredicate(BusinessId) ON app.IdempotencyRecords,
ADD BLOCK PREDICATE security.TenantPredicate(BusinessId) ON app.IdempotencyRecords AFTER INSERT,
ADD BLOCK PREDICATE security.TenantPredicate(BusinessId) ON app.IdempotencyRecords AFTER UPDATE
WITH (STATE=ON,SCHEMABINDING=ON);
GO
CREATE SECURITY POLICY security.SupportAccessGrantsTenantPolicy
ADD FILTER PREDICATE security.TenantPredicate(BusinessId) ON app.SupportAccessGrants,
ADD BLOCK PREDICATE security.TenantPredicate(BusinessId) ON app.SupportAccessGrants AFTER INSERT,
ADD BLOCK PREDICATE security.TenantPredicate(BusinessId) ON app.SupportAccessGrants AFTER UPDATE
WITH (STATE=ON,SCHEMABINDING=ON);
GO
CREATE SECURITY POLICY security.BusinessesTenantPolicy
ADD FILTER PREDICATE security.TenantPredicate(Id) ON platform.Businesses,
ADD BLOCK PREDICATE security.TenantPredicate(Id) ON platform.Businesses AFTER INSERT,
ADD BLOCK PREDICATE security.TenantPredicate(Id) ON platform.Businesses AFTER UPDATE
WITH (STATE=ON,SCHEMABINDING=ON);
GO
CREATE ROLE servicedesk_app;
GO
GRANT SELECT,INSERT,UPDATE ON SCHEMA::app TO servicedesk_app;
GRANT SELECT,UPDATE ON OBJECT::platform.Businesses TO servicedesk_app;
GRANT SELECT ON OBJECT::platform.Plans TO servicedesk_app;
GRANT SELECT ON OBJECT::platform.PlanEntitlements TO servicedesk_app;
GRANT SELECT ON OBJECT::auth.Roles TO servicedesk_app;
GRANT SELECT ON OBJECT::auth.Permissions TO servicedesk_app;
GRANT SELECT ON OBJECT::auth.RolePermissions TO servicedesk_app;
DENY UPDATE,DELETE ON OBJECT::app.AuditEvents TO servicedesk_app;
DENY UPDATE,DELETE ON OBJECT::app.EstimateDecisions TO servicedesk_app;
DENY UPDATE,DELETE ON OBJECT::app.CreditNotes TO servicedesk_app;
DENY INSERT,UPDATE,DELETE ON OBJECT::app.SupportAccessGrants TO servicedesk_app;
GO
-- Provisioning, billing webhook and platform operations use separate narrowly
-- granted service principals/procedures. Never grant db_owner to the API.
-- RLS is a tenant boundary, not a staff permission or authentication system.
-- The API validates membership BEFORE setting BusinessId. See tenant-boundaries.md.
