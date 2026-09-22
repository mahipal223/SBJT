# ServiceDesk browser workflow review — September 21, 2026

Scope: local application at `http://localhost:4200`, signed-in owner workspace. The user authorized new customers and QA records. This report records the work performed before the September 22 prototype request; it is not a claim that every application capability was tested.

**Verdict: fix payment and workflow defects before release; global readiness is incomplete.** Visual baseline comparison is inconclusive because no reference screenshots were supplied.

## Completed end-to-end test

Created customer **QA Global Workflow 20260921**, job **J-0009 / QA Service Workflow 20260921**, estimate **EST-0003**, and invoice **INV-0007**.

- Customer creation and customer-prefilled job form worked after local servers were restarted.
- Initial Diagnostic Fee 75 plus two Air Filter Replacement items at 45 produced 165.
- Estimate creation and Sent status worked. A public approval link accepted the synthetic customer's response and the owner estimate displayed Approved.
- Scheduled → In Progress → Completed worked; completion produced a draft invoice.
- Invoice issue worked with Net 14 due date.
- Cash payment of 65 reduced balance to 100. A second cash payment with a distinct reference settled the balance to zero and displayed Paid.
- Reports increased recorded revenue from 2,580 to 2,745, matching the added 165.
- Jobs CSV export request reached Ready; file contents were not inspected.
- Audit trail showed estimate, job-status, invoice, and payment events.
- Created reusable catalog item **QA Standard Service 20260921** at 25 and scheduled **J-0010 / QA Weekend Schedule 20260921** for September 26 with that item. Weekend visibility was not subsequently verified before the task shifted to redesign.

## Prioritized findings

### P1 — Card and bank-transfer UI values do not match API values

**Reproduce:** Open an issued invoice, Record payment, leave Credit Card selected, enter a positive amount below the balance, submit.

**Observed:** “Enter a positive amount and a valid payment method.” Cash worked with the same amount.

**Source confirmation:** `financial-pages.ts` passes `Credit Card` and offers `Bank Transfer`; `FinancialService.RecordPaymentAsync` accepts `Card` and `BankTransfer` instead. The list quick-pay and issue-and-pay paths also contain the `Credit Card` literal. Their failure is inferred from the same mismatch, not separately browser-tested.

**Change:** Use shared codes and separate display labels; test every supported method and shortcut.

### P1 — Completion shortcut fails on Scheduled jobs

**Reproduce:** Scheduled J-0009 → Complete & create invoice.

**Observed:** “A Scheduled job cannot change to Completed.” Starting the job first, then using the shortcut, worked.

**Change:** Present Start job on Scheduled jobs. Present Complete & create invoice only when its transition is valid, or implement an explicitly supported server command for the intended shortcut.

### P1 — Outstanding invoice count includes settled documents

**Observed:** Overview initially showed 5 outstanding invoices and 0 pending. After the QA invoice was fully paid, it showed 6 and still 0 pending.

**Source evidence:** `ReportService` counts invoices by stored Issued/PartiallyPaid status without filtering positive balance. Detail UI can show Paid from computed balance while the dashboard count uses another definition.

**Change:** Share a consistent balance/status definition including successful payments, credits, and refunds. Count only invoices that actually require collection.

### P2 — Payment failure is hidden behind the modal

**Reproduce:** Enter an invalid payment method or overpay while the dialog is open.

**Observed:** Error banner appears on the blurred underlying page. The amount field has no nearby corrective message. The underlying invoice details also disappear in the error state.

**Change:** Keep invoice content intact; display field errors below inputs and general server errors inside the active dialog. Move focus to the first invalid field.

### P2 — Reference / Note acts as a unique payment identifier

**Reproduce:** Record one partial payment with a note, open Record payment again, retain the prefilled note, submit the remainder.

**Observed:** Generic financial server error. Server log identified a duplicate key on `UX_Payments_External`. Using a different reference succeeded.

**Change:** Clear reference on every new payment. Separate free-text notes from unique external references. Return a useful conflict response for duplicate references instead of a generic error.

### P1 for global launch — Currency and address behavior are inconsistent

**Observed:** Invoice balance displayed `$100.00`, while overpayment validation reported `₹ 100.00`. Business settings showed USD. Customer form defaulted to Austin, TX, 78701 with no country field. Source validation requires a five-digit US ZIP format.

**Change:** Use workspace currency/locale consistently on server messages, screens, documents, and exports. Introduce country-aware address/postal validation and international phone support. Reconcile the repository's US-specific input rules with the global-product requirement before implementation.

### P2 — Reports mix measures without clear labels

**Observed:** Total Revenue 2,745; Revenue by Category and Team Revenue 2,790; Jobs Completed 7; trend caption 6 jobs. These are not necessarily arithmetic errors: collections, invoice line totals, and invoice counts can differ. The UI does not explain that distinction.

**Change:** Label Collected payments, Invoiced sales, Completed jobs, and Invoice count explicitly. Document period boundaries and refund/draft treatment. Provide drill-through records for reconciliation.

### P2 — Local timestamps are labeled UTC

**Observed:** Audit table header says Timestamp (UTC), but the newly recorded payment displayed 3:32 PM in the Asia/Calcutta browser context. Other screen dates also used browser-local rendering while business settings were UTC.

**Change:** Render the named time zone explicitly or label the actual displayed zone. Review “today” and monthly boundaries using the business time zone.

### P2 — Navigation suggests features that are inactive

**Observed/source:** The top search is a decorative div; Help and Notifications have no click handlers in the shell. Clicking Billing & tax in Business settings did not change the profile view; several settings labels are static.

**Change:** Implement the advertised action, or remove/clearly label the unavailable feature. A visible keyboard shortcut should work on the user's platform.

### P2 — Search results alter the displayed usage count

**Observed:** Filtering Jobs to “QA” changed This period to 1 / 100, alongside All jobs 1, although the workspace had nine jobs at that point.

**Change:** Keep subscription usage independent of list filters; label filtered result count separately.

### P2 — Payment history is missing from the invoice detail screen

**Observed:** After partial and full settlement, the page showed balance/status and line items but no visible history of the two payments.

**Change:** Show date, method, amount, reference, and actor for each record, plus a clear balance reconciliation.

## Design and speed recommendations

1. Make the next valid action primary: Start → Complete → Review invoice → Record payment.
2. Allow multiple saved items to be selected in one picker; keep quantity and price visible.
3. Keep customer creation inside the job form and preserve entered job data.
4. Use compact two-column phone metrics and job cards rather than large stacked KPI cards and wide tables.
5. Keep the mobile save action above bottom navigation with reserved space so the two controls cannot overlap.
6. Replace technical product copy such as “SQL Server,” “tenant,” and “RFC 4180” with the owner's business task.
7. Make date/currency/country settings consistent end to end. Global support is more than adding currency choices.

The [September 22 clickable prototype](design-prototype/README.md) demonstrates these design changes with fictional data. It does not fix the live application defects.

## Limits and environment notes

- First requests failed with connection refused because local frontend/API servers had stopped while a cached SPA remained visible. Both were restarted. Customer creation succeeded afterward; these initial failures are not classified as application defects.
- API startup logged a local Data Protection key-directory permission error. The tested owner session continued to work; authentication persistence and production auth were not validated.
- Layouts were inspected at 390, 768, 1024, and desktop widths. At 1024 the job table required horizontal scrolling. No complete WCAG/contrast or real-device test was run.
- No proof was established for SMTP delivery to a real inbox, PDF output, CSV contents, tenant isolation, role denial, concurrent writes, idempotent retries, refunds, subscription billing, team changes, authentication/logout, or all status transitions.
- Test records remain in the local workspace. No real payment was taken. The test customer uses an `example.invalid` email address. The invoice queued an outbound message, but delivery was not validated.
- This is a functional/design review, not a security, financial compliance, or load-test certification.
