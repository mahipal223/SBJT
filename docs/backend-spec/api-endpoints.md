# API endpoint index

Base: `/api/v1`. `businessId` in a route is a requested scope, never authorization. See OpenAPI for request bodies, responses and required headers.

Implemented job creation accepts an optional `scheduledDate` (`YYYY-MM-DD`) and
`arrivalWindow` (for example `9:00 AM – 10:00 AM`). Both entered times are preserved.
When a date is supplied without a window, the appointment defaults to 9:00–10:30 AM.
Malformed or reversed windows return `400 validation_failed` before creating a job.

| Method | Path | Permission | Request | Response |
|---|---|---|---|---|
| GET | /me | authenticated | — | Me |
| POST | /businesses | authenticated | CreateBusiness | Business |
| GET | /plans | public | — | PlanPage |
| GET | /businesses/{businessId} | workspace.read | — | Business |
| PATCH | /businesses/{businessId} | workspace.manage | UpdateBusiness | Business |
| GET | /businesses/{businessId}/operations/{operationId} | workspace.read + original operation permission | — | OperationStatus |
| GET | /businesses/{businessId}/members | team.manage | — | MemberPage |
| GET | /businesses/{businessId}/invitations | team.manage | — | InvitationPage |
| POST | /businesses/{businessId}/invitations | team.manage | InviteMember | Invitation |
| POST | /invitations/accept | authenticated | AcceptInvitation | Member |
| POST | /businesses/{businessId}/invitations/{invitationId}/revoke | team.manage | — | CommandResult |
| PATCH | /businesses/{businessId}/members/{memberId}/role | team.manage | ChangeMemberRole | Member |
| POST | /businesses/{businessId}/members/{memberId}/deactivate | team.manage | DeactivateMember | CommandResult |
| POST | /businesses/{businessId}/ownership/transfer | team.manage | TransferOwnership | Business |
| GET | /businesses/{businessId}/team/solo-preview | team.manage | — | SoloPreview |
| POST | /businesses/{businessId}/team/switch-to-solo | team.manage | SwitchToSolo | Business |
| GET | /businesses/{businessId}/customers | customers.read | — | CustomerPage |
| POST | /businesses/{businessId}/customers | customers.write | CreateCustomer | Customer |
| GET | /businesses/{businessId}/customers/{id} | customers.read | — | Customer |
| PATCH | /businesses/{businessId}/customers/{id} | customers.write | UpdateCustomer | Customer |
| POST | /businesses/{businessId}/customers/{id}/archive | customers.write | Reason | CommandResult |
| GET | /businesses/{businessId}/catalog-items | catalog.read | — | CatalogItemPage |
| POST | /businesses/{businessId}/catalog-items | catalog.write | CreateCatalogItem | CatalogItem |
| GET | /businesses/{businessId}/catalog-items/{id} | catalog.read | — | CatalogItem |
| PATCH | /businesses/{businessId}/catalog-items/{id} | catalog.write | UpdateCatalogItem | CatalogItem |
| POST | /businesses/{businessId}/catalog-items/{id}/archive | catalog.write | Reason | CommandResult |
| GET | /businesses/{businessId}/customers/{customerId}/locations | customers.read | — | LocationPage |
| POST | /businesses/{businessId}/customers/{customerId}/locations | customers.write | CreateLocation | Location |
| PUT | /businesses/{businessId}/customers/{customerId}/locations/{id} | customers.write | CreateLocation | Location |
| POST | /businesses/{businessId}/customers/{customerId}/locations/{id}/archive | customers.write | Reason | CommandResult |
| GET | /businesses/{businessId}/customers/{customerId}/assets | customers.read | — | AssetPage |
| POST | /businesses/{businessId}/customers/{customerId}/assets | customers.write | CreateAsset | Asset |
| PUT | /businesses/{businessId}/customers/{customerId}/assets/{id} | customers.write | CreateAsset | Asset |
| POST | /businesses/{businessId}/customers/{customerId}/assets/{id}/archive | customers.write | Reason | CommandResult |
| GET | /businesses/{businessId}/jobs | jobs.read | — | JobPage |
| POST | /businesses/{businessId}/jobs | jobs.write | CreateJob | Job |
| GET | /businesses/{businessId}/jobs/{jobId} | jobs.read | — | Job |
| PATCH | /businesses/{businessId}/jobs/{jobId} | jobs.write | UpdateJob | Job |
| GET | /businesses/{businessId}/my-jobs | jobs.assigned.read OR jobs.read | — | JobWorkViewPage |
| GET | /businesses/{businessId}/jobs/{jobId}/work-view | jobs.work | — | JobWorkView |
| PUT | /businesses/{businessId}/jobs/{jobId}/assignments | jobs.assign | AssignJob | Job |
| POST | /businesses/{businessId}/jobs/{jobId}/status | jobs.work OR jobs.write | ChangeJobStatus | JobWorkView |
| PUT | /businesses/{businessId}/jobs/{jobId}/items | jobs.write | ReplaceItems | LineItemSet |
| GET | /businesses/{businessId}/appointments | jobs.read | — | AppointmentPage |
| POST | /businesses/{businessId}/jobs/{jobId}/appointments | jobs.assign | CreateAppointment | Appointment |
| PUT | /businesses/{businessId}/appointments/{appointmentId} | jobs.assign | CreateAppointment | Appointment |
| POST | /businesses/{businessId}/appointments/{appointmentId}/cancel | jobs.assign | Reason | CommandResult |
| GET | /businesses/{businessId}/jobs/{jobId}/notes | jobs.work | — | JobNotePage |
| POST | /businesses/{businessId}/jobs/{jobId}/notes | jobs.work | CreateNote | JobNote |
| GET | /businesses/{businessId}/jobs/{jobId}/time-entries | jobs.work | — | TimeEntryPage |
| POST | /businesses/{businessId}/jobs/{jobId}/time-entries | jobs.work | TimeEntryInput | TimeEntry |
| PUT | /businesses/{businessId}/jobs/{jobId}/time-entries/{id} | jobs.work | TimeEntryInput | TimeEntry |
| POST | /businesses/{businessId}/jobs/{jobId}/files/upload-ticket | jobs.work | UploadRequest | UploadTicket |
| POST | /businesses/{businessId}/jobs/{jobId}/files/{fileId}/complete | jobs.work | — | AsyncOperation |
| GET | /businesses/{businessId}/jobs/{jobId}/files/{fileId}/download | jobs.work | — | DownloadTicket |
| GET | /businesses/{businessId}/jobs/{jobId}/checklist | jobs.work | — | ChecklistItemPage |
| PUT | /businesses/{businessId}/jobs/{jobId}/checklist | jobs.write | ChecklistInput | ChecklistItemPage |
| PATCH | /businesses/{businessId}/jobs/{jobId}/checklist/{id} | jobs.work | CompleteChecklistItem | ChecklistItem |
| GET | /businesses/{businessId}/estimates | estimates.manage | — | EstimatePage |
| POST | /businesses/{businessId}/jobs/{jobId}/estimates | estimates.manage | CreateEstimate | Estimate |
| GET | /businesses/{businessId}/estimates/{estimateId} | estimates.manage | — | Estimate |
| PUT | /businesses/{businessId}/estimates/{estimateId} | estimates.manage | CreateEstimate | Estimate |
| POST | /businesses/{businessId}/estimates/{estimateId}/send | estimates.manage | SendDocument | AsyncOperation |
| POST | /businesses/{businessId}/estimates/{estimateId}/revise | estimates.manage | CreateEstimate | Estimate |
| POST | /businesses/{businessId}/estimates/{estimateId}/public-link | estimates.manage | — | PublicEstimateLink |
| GET | /public/estimates/{token} | capability token | — | PublicEstimate |
| POST | /public/estimates/{token}/decision | capability token | EstimateDecision | CommandResult |
| GET | /businesses/{businessId}/invoices | invoices.manage | — | InvoicePage |
| POST | /businesses/{businessId}/jobs/{jobId}/invoices | invoices.manage | CreateInvoice | Invoice |
| GET | /businesses/{businessId}/invoices/{invoiceId} | invoices.manage | — | Invoice |
| PATCH | /businesses/{businessId}/invoices/{invoiceId} | invoices.manage | UpdateInvoice | Invoice |
| POST | /businesses/{businessId}/invoices/{invoiceId}/issue | invoices.manage | — | Invoice |
| POST | /businesses/{businessId}/invoices/{invoiceId}/send | invoices.manage | SendDocument | AsyncOperation |
| POST | /businesses/{businessId}/invoices/{invoiceId}/void | invoices.manage | Reason | Invoice |
| GET | /businesses/{businessId}/invoices/{invoiceId}/pdf | invoices.manage | — | DownloadTicket |
| GET | /businesses/{businessId}/invoices/{invoiceId}/payments | payments.manage | — | PaymentPage |
| POST | /businesses/{businessId}/invoices/{invoiceId}/payments | payments.manage | RecordPayment | Payment |
| POST | /businesses/{businessId}/payments/{paymentId}/refunds | payments.manage | RefundPayment | Refund |
| POST | /businesses/{businessId}/invoices/{invoiceId}/credits | payments.manage | CreateCreditNote | CreditNote |
| GET | /businesses/{businessId}/subscription | subscription.manage | — | Subscription |
| GET | /businesses/{businessId}/usage | subscription.manage | — | Usage |
| POST | /businesses/{businessId}/subscription/checkout | subscription.manage | CheckoutRequest | HostedSession |
| POST | /businesses/{businessId}/subscription/portal | subscription.manage | — | HostedSession |
| POST | /businesses/{businessId}/subscription/change-preview | subscription.manage | PlanChangeRequest | PlanChangePreview |
| POST | /businesses/{businessId}/subscription/change | subscription.manage | PlanChangeRequest | AsyncOperation |
| POST | /businesses/{businessId}/subscription/cancel | subscription.manage | Reason | Subscription |
| GET | /businesses/{businessId}/dashboard | reports.read | — | Dashboard |
| GET | /businesses/{businessId}/reports/jobs | reports.read | — | JobReport |
| GET | /businesses/{businessId}/reports/financial | reports.read | — | FinancialReport |
| POST | /businesses/{businessId}/exports | exports.manage | ExportRequest | Export |
| GET | /businesses/{businessId}/exports | exports.manage | — | ExportPage |
| GET | /businesses/{businessId}/exports/{exportId} | exports.manage | — | Export |
| GET | /businesses/{businessId}/exports/{exportId}/download | exports.manage | — | DownloadTicket |
| GET | /businesses/{businessId}/audit-events | audit.read | — | AuditEventPage |
| POST | /businesses/{businessId}/support-grants | support.approve | SupportGrantInput | SupportGrant |
| POST | /businesses/{businessId}/support-grants/{grantId}/revoke | support.approve | — | CommandResult |
| POST | /webhooks/subscription-billing | verified provider signature | — | WebhookAck |
| GET | /admin/me | platform:Support | — | PlatformOperator |
| GET | /admin/businesses | platform:Support | — | BusinessPage |
| GET | /admin/businesses/{businessId} | platform:Support | — | Business |
| PATCH | /admin/businesses/{businessId}/status | platform:OperationsAdmin | UpdateBusinessStatus | CommandResult |
| GET | /admin/plans | platform:BillingAdmin | — | PlanPage |
| POST | /admin/plans | platform:BillingAdmin | CreatePlan | Plan |
| GET | /admin/metrics | platform:OperationsAdmin | — | PlatformMetrics |
| GET | /admin/backups | platform:OperationsAdmin | — | BackupRunPage |
| POST | /admin/restores | platform:OperationsAdmin | RestoreRequest | AsyncOperation |
| GET | /admin/restores/{restoreId} | platform:OperationsAdmin | — | OperationStatus |
| GET | /admin/audit-events | platform:OperationsAdmin | — | PlatformAdminAuditEventPage |
| GET | /businesses/{businessId}/subscription/invoices | subscription.manage | — | SubscriptionInvoicePage |
