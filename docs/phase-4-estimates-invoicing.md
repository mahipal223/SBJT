# Phase 4 — job completion, estimates, invoicing, and payments

Phase 4 connects the completed job workflow to customer estimates, invoices, and manual payment tracking.

## Delivered

- Validated job status transitions with tenant-scoped audit events.
- Scheduled jobs default to the current member when no technician is selected, supporting solo workspaces.
- A job must contain at least one service, labor, or part item before completion.
- Estimates copy customer and job-item snapshots so later edits do not change sent pricing.
- Estimate creation checks the current `estimates.enabled` plan entitlement and fails closed when it is missing or disabled.
- Invoices can be created only from completed jobs and only one live invoice may exist for a job.
- Invoice issue dates and due dates are validated before issue.
- Manual payments recalculate the invoice balance and payment status and reject overpayment.
- Financial changes run in SQL transactions and append tenant audit records.
- Angular estimate and invoice pages provide loading, empty, error, refresh, filtering, issue, send, and record-paid states.

## API routes

| Method | Route | Permission |
| --- | --- | --- |
| POST | `/api/v1/businesses/{businessId}/jobs/{jobId}/status` | `jobs.write` |
| GET | `/api/v1/businesses/{businessId}/estimates` | `estimates.manage` |
| POST | `/api/v1/businesses/{businessId}/jobs/{jobId}/estimates` | `estimates.manage` |
| POST | `/api/v1/businesses/{businessId}/estimates/{estimateId}/send` | `estimates.manage` |
| GET | `/api/v1/businesses/{businessId}/invoices` | `invoices.manage` |
| POST | `/api/v1/businesses/{businessId}/jobs/{jobId}/invoices` | `invoices.manage` |
| POST | `/api/v1/businesses/{businessId}/invoices/{invoiceId}/issue` | `invoices.manage` |
| POST | `/api/v1/businesses/{businessId}/invoices/{invoiceId}/payments` | `payments.manage` |

## Job status rules

The implemented transitions are:

- `Draft` → `Scheduled` or `Cancelled`
- `Scheduled` → `InProgress`, `OnHold`, or `Cancelled`
- `InProgress` → `OnHold`, `Completed`, or `Cancelled`
- `OnHold` → `Scheduled`, `InProgress`, or `Cancelled`
- `Completed` → `InProgress` for an authorized reopen with a reason

Cancellation and reopening require a reason. Scheduling requires an appointment date, and completion requires job items.

## Financial snapshot rules

Estimate and invoice rows store the customer name and address at creation time. Their line-item tables store the type, description, quantity, unit, price, discount, tax, sort order, and calculated line total. Financial totals are calculated by the API from these stored snapshots rather than values supplied by Angular.

## Verification

The real SQL Server development workflow was verified with the restricted runtime login:

1. Created and sent estimate `EST-0001` for scheduled job `J-0002`.
2. Changed the job from `Scheduled` to `InProgress` to `Completed`.
3. Created and issued invoice `INV-0001` for `$193.00`.
4. Recorded a `$193.00` cash payment.
5. Confirmed final payment status `Paid` and balance `$0.00`.

Repository checks after moving to `D:\TempDebug\SBJT`:

- `dotnet format ServiceDesk.slnx --no-restore --verify-no-changes`
- `dotnet build ServiceDesk.slnx --no-restore` — zero warnings and zero errors
- `dotnet run --project tests/ServiceDesk.Api.Tests --no-build`
- `npm --prefix src/ServiceDesk.Web run build`
- `npm --prefix src/ServiceDesk.Web test -- --watch=false` — two tests passed

## Next slice

Add estimate detail/revision and customer acceptance, invoice PDF and email delivery through the outbox, idempotency keys for financial commands, refunds and credit notes, and SQL integration tests for concurrent numbering and payment writes.
