# Implementation and acceptance checklist

## Enforcement responsibility

| Invariant | Supplied database protection | Required API/service behavior |
|---|---|---|
| Same-business records | Composite keys/FKs and RLS | Authenticate, verify current membership, establish tenant context. |
| Customer/location/asset consistency | Composite customer-qualified foreign keys | Clear validation response; reject archived choices for new jobs. |
| Tenant change on a row | RLS after-update block | Treat BusinessId as immutable; never bind from request. |
| Staff role and assigned-job access | Membership/role relations | ASP.NET authorization handlers and distinct technician DTOs. |
| At least one owner | No SQL cross-row owner guard | Serialize membership/ownership transactions; reject last-owner removal. |
| Seat limit | Membership and unique pending-invitation records | Lock business/seat resource; count active + reserved; handle expiry. |
| Job transition | SQL transition trigger | Role, schedule, checklist, timers, reason and approval conditions. |
| Issued invoices | Item/header immutability triggers and line-total check at issue | Freeze snapshots; authorize issue/send/void; ensure Completed job. |
| One live invoice per job | Filtered unique index | Explain conflict and guide void/credit/follow-up job. |
| Estimate revisions | Sent item guard and unique decision | Freeze header; valid transition, totals, capability expiry and revision logic. |
| Payment/refund/credit totals | Positive values and succeeded-payment protection | Lock invoice/payment; no overpayment/over-refund; reconcile totals. |
| Audit append-only | Runtime UPDATE/DELETE denial | Insert audit events with each mutation; prohibit secret payloads. |
| Outbox/idempotency | Scoped unique idempotency key and outbox storage | Atomic mutation+event+response; retry worker and deduplicate external effects. |
| Plan transitions | Unique current subscription and constrained states | Provider verification, state reconciliation and downgrade eligibility. |
| Backup and restore | Metadata relationships only | Configure real backups, encryption, monitoring and restore drills. |

Do not claim the schema alone enforces all product rules. SQL triggers are backstops, not replacements for command services.

## ASP.NET Core modules

1. Identity and tenant middleware: JWT/OIDC, membership lookup, policy handlers, scoped TenantContext, EF connection interceptor and concurrency middleware.
2. Business/access commands: onboarding, invite/accept/revoke, deactivate/reactivate, ownership transfer and solo preview/commit.
3. Customers/catalog: validation, scoped CRUD/search, archive and industry-detail schemas.
4. Work management: jobs, assignments, appointments, actual line items, time, checklist and private files.
5. Financial documents: estimate snapshots/approval, invoices, issue/send/PDF, payment/refund/credit ledger.
6. SaaS billing: entitlement resolver, atomic quota reservations, hosted checkout, provider event inbox and plan-change worker.
7. Operations: transactional outbox, reminder scheduling, exports, reports, audit, controlled administration and recovery metadata.

Prefer command handlers with explicit transaction boundaries. Read projections may be separate queries. Controllers perform binding/routing; services own invariants. Start with a modular monolith and one SQL database, not distributed microservices.

## Acceptance scenarios

### Tenant/security

- Create businesses A/B and confirm every list/detail/update/download/export rejects or hides the other business's records.
- Attempt inserting an A job with B customer/member IDs and an A job with the wrong A customer's location/asset.
- Reuse a pooled SQL connection across A, B, missing context and failed requests; verify no context leakage.
- Use the actual restricted runtime principal and attempt modifying RLS, creating users, reading auth users or altering audit history; reject all.
- Revoke a technician while their token and download page remain open; subsequent requests must fail. Already issued short-lived object URLs expire within the configured window.
- Enumerate missing and foreign IDs and verify indistinguishable 404 responses.

### Solo/team

- Solo owner creates a job and receives default assignment.
- Two simultaneous invitations compete for the final seat; only one reserves it.
- A revoked/expired/forwarded invitation or wrong verified email cannot join.
- A previously inactive member accepts a valid new invitation without duplicate historical membership.
- Attempt last-owner deactivation and concurrent ownership changes; preserve at least one active owner.
- Commit solo transition while another request adds an assignment/member; recheck/serialize and return conflict rather than silently omitting work.
- Returning to solo leaves completed history and financial records attributed to original staff.

### Financial/workflow

- Block Draft → Completed, unauthorized reopen and completion with required incomplete checklist/open timers.
- Block expired/superseded estimate approval; an exact retry returns the original decision.
- Prevent catalog price edits from changing issued documents.
- For a $450 invoice: record $100 then $350; return PartiallyPaid then Paid. Reject another payment.
- Refund $50 without credit: balance becomes $50. Add matching $50 credit: zero balance. Reject refunds above the original unrefunded payment.
- Race two payments against the same balance; locking prevents overpayment.
- Attempt line/header edits after issue and void with payment history; reject.
- Check midnight/time-zone boundaries for overdue flag and appointment ranges.
- Retry stale If-Match and duplicate idempotency keys with both matching and changed payloads.

### Subscription/operations

- Replay and reorder provider events; preserve the correct paid period and one current subscription.
- Failed renewal grace does not reset on retry. Trial expiry does not delete records.
- Downgrade with excess seats/storage is blocked at preview and rechecked at effective time.
- Export requester loses access mid-job; fail/cancel generation or deny delivery.
- Send-email failure retries through outbox without duplicate invoice/payment creation.
- Restore a backup into an isolated environment; verify representative tenant records, files and document totals. Record results and recovery duration.

## Follow-up schema refinements

Before implementing provider-specific integrations, add their narrow inbox/transaction/projection fields through new migrations. Validate JSON schemas for business settings, tax breakdowns, asset details, billing snapshots and outbox events. Add indexes from measured query plans rather than indexing every field.
