# Status and financial rules — v1

These are implementation requirements. SQL guards implement only the subset listed in README; API services must enforce the remaining conditions transactionally.

## Jobs

| From | Allowed next status | Conditions |
|---|---|---|
| Draft | Scheduled, Cancelled | Scheduling requires an active assignment and a valid future/current appointment. Cancellation requires a reason. |
| Scheduled | InProgress, OnHold, Cancelled | Assigned technician may start or hold. Owner/manager may cancel. |
| InProgress | OnHold, Completed, Cancelled | Completion requires required checklist items, ended timers, confirmed actual labor/parts, and approval of any added scope. |
| OnHold | Scheduled, InProgress, Cancelled | Record hold reason and resolution; validate assignment/appointment when rescheduling. |
| Completed | InProgress | Owner/manager only; reason required. Preserve issued invoice snapshots. Use a follow-up job for additional billable work after invoicing. |
| Cancelled | None | Clone into a new Draft job if needed. |

Technicians may make Scheduled → InProgress, InProgress → OnHold/Completed, OnHold → InProgress on assigned jobs only. They cannot cancel, reopen, change prices, assign staff or edit the customer. Owner can perform technician work. Completion does not imply payment. Cancel future appointments and stop timers when cancelling a job. `CompletedAt` and `CancelledAt` are set/cleared consistently by the command service, not trusted from a request.

## Estimates

Draft → Sent → Approved / Declined / Expired / Superseded.

- Drafts are editable; sending freezes items and snapshots. A failed email retries delivery without changing the approved financial content.
- Revise a sent, declined, expired or approved estimate by creating a new revision in Draft. On sending the replacement, supersede the old revision and revoke its links. Keep earlier decisions and amounts.
- A public decision binds to one exact revision, with token expiry, document expiry, verified token hash, approver details and timestamp. Compare `ValidUntil` to the business-local date. Do not accept decisions on drafts, expired or superseded revisions.
- Record only one final decision per revision. Retries return the same result. Approval of added scope must be recorded before that work proceeds.
- Before send, calculate estimate header totals from its lines; this remains an API invariant in v1.

## Invoices: three independent dimensions

| Dimension | Values | Meaning |
|---|---|---|
| Lifecycle | Draft, Issued, Voided | Issued documents have frozen billing details and amounts. |
| Delivery | NotSent, Queued, Sent, Failed | Sending does not establish settlement. |
| Payment status (calculated) | Unpaid, PartiallyPaid, Paid, SettledByCredit, CreditBalance, NotApplicable | Derived from successful payments, refunds and credits; never patched by clients. |
| Overdue flag (calculated) | true / false | Issued, positive balance, and business-local today is later than DueOn. |

- Create an invoice only for a Completed job in the MVP. Deposit/progress invoicing is deferred.
- Draft → Issued requires at least one line, issued/due dates, business/customer billing snapshots and matching totals.
- Issued → Voided requires a reason and no pending/succeeded payment or credit history. A refunded invoice still has payment history: use credit notes, not voiding.
- Issued invoices cannot return to Draft. Do not rewrite issued line items, document number, dates, customer, address, tax or prices.
- On the next invoice for the same job, prevent unintentionally rebilling the same work. MVP allows only one non-void invoice per job at the API layer; SQL should use the additional filtered index in the final schema.
- Snapshot the business name/address, customer name/address, applicable line tax rates, tax amounts and payment terms. Example JSON must follow a versioned application schema.

## Decimal arithmetic

Use C# `decimal`, SQL `decimal`, and decimal strings in JSON. USD only in MVP.

1. `lineGross = Round(quantity × unitPrice, 2, AwayFromZero)`.
2. `lineNet = lineGross − discountAmount`; discounts cannot exceed gross.
3. Compute line tax from validated business tax configuration, using the same rounding rule. Do not accept final tax amounts from browser input.
4. `lineTotal = lineNet + taxAmount`.
5. Header subtotal/discount/tax/total equal their respective line sums. Reject arithmetic overflow and amounts outside SQL column ranges.
6. `netPaid = sum(succeeded payments) − sum(succeeded refunds)`.
7. `credited = sum(credit notes)`; credits cannot exceed original total.
8. `rawBalance = total − credited − netPaid`; `balanceDue = max(0, rawBalance)`; `customerCredit = max(0, -rawBalance)`.

Payment status: Draft/Voided → NotApplicable; negative rawBalance → CreditBalance; fully credited with no net payment → SettledByCredit; zero rawBalance → Paid; positive netPaid and positive balance → PartiallyPaid; otherwise Unpaid. A zero-value issued invoice is Paid with zero balance.

Reject payments greater than current balance and refunds exceeding the unrefunded successful payment. Refunds reverse money movement; credit notes reduce the amount owed. A refund without credit reopens the balance. Customer credit is refunded or resolved explicitly; never hide it by clamping silently.

Lock the invoice row with `UPDLOCK,HOLDLOCK` for payment, refund, credit, issue and void operations. Use a consistent lock order: invoice, payment, child records. Insert the financial entry, bump the invoice rowversion, write audit and outbox records, and complete the idempotency record within the same database transaction. External payment/refund calls occur outside database locks and reconcile by verified provider events.

Manual payment recording in v1 does not charge a card. Subscription checkout is a separate provider flow. Do not collect or store card numbers in this database.
