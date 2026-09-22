# ServiceDesk responsive design prototype

This is a clickable design proposal for small service businesses, based on the September 21 browser review. It does not modify the Angular application or call the API.

## Open the design

Open `review.html` in a browser for the **Desktop / Mobile** switch and screen selector. Choose **Open full screen** to use the responsive prototype directly. All assets are local; no external fonts or services are required.

For the local server, run from the repository root:

```powershell
node docs/design-prototype/serve.cjs
```

Then open [the design review](http://127.0.0.1:4310/review.html). The server listens only on this computer's loopback interface.

## Included screens

| Screen | Desktop | Mobile |
|---|---|---|
| Dashboard | Four compact metrics, today's work, attention queue | Two-column metrics, stacked agenda, bottom navigation |
| Jobs | Search, status filters, readable table | Full-width tappable job cards |
| Create job | Three sections with a sticky summary | Single column and sticky total/create action above navigation |
| Job details | Visit, services, customer, documents, next action | Stacked sections, visible progress and primary action |
| Add items | Searchable multi-item dialog and custom item entry | Bottom sheet with its own scroll area and add action |
| Estimates | Document, approval status, customer-preview action | Readable document and stacked approval controls |
| Customer approval | Review scope, inline validation, decision result | Same flow in one column |
| Invoices | Document, balance, payment history | Stacked document and history |
| Record payment | Amount, explicit method, date, optional reference | Bottom sheet, inline errors, partial-payment support |
| Schedule | Seven selectable days and chronological visits | Compact seven-day strip and visit cards |
| Customers | Contact cards and create-job shortcuts | Single-column contact cards and inline creation dialog |
| Services & parts | Saved price book and use-in-job action | Compact saved-item rows |
| Reports | Collected/open balances, work status, sample chart | Compact metrics and stacked chart panels |
| Preferences | Currency and regional-format preview | Single-column responsive settings |

## Try the complete flow

1. Open **Create job**. Choose a customer or use **New customer** without leaving the form. A sample customer is initially selected to make the walkthrough quick.
2. Enter a title or choose a quick title.
3. Choose **Add items**, select Diagnostic visit and Air filter, then **Add to job**. Increase Air filter quantity to two: the total is **165.00**.
4. Choose a visit date or **Schedule later**, then **Create job**.
5. Use **Create estimate → Prepare to send → Simulate sending → Preview customer view**. Enter a sample name/email and approve.
6. Return to the estimate, select **Continue job**, then **Start job → Complete job → Complete & draft invoice**.
7. Issue the demo invoice and record **65.00** and **100.00** as separate payments. The balance becomes zero and both records remain visible.
8. Review the dashboard, invoice list, and reports. Use **Reset demo** to restore the initial state.

All customer records are fictional. The demo date is fixed at September 22, 2026. Sample data is held in memory, so refreshing resets it. Switching between Desktop and Mobile in the review wrapper retains the same iframe state.

## Design decisions

| Existing friction | Proposed change | Reason |
|---|---|---|
| Many competing actions and technical dashboard copy | One main action per state; everyday business labels | Helps the owner decide what to do next |
| Long phone tables | Job cards with customer, date, status, total | Keeps essential information readable without sideways scrolling |
| Repeated catalog selection | Select multiple saved items, then adjust quantities | Reduces repeated searching and form opening |
| Broken completion shortcut on Scheduled jobs | Scheduled → Start job; In progress → Complete job | Matches the existing server state machine |
| Payment error outside its dialog | Errors under the affected input inside the dialog | Makes correction immediate |
| Reused payment reference and default card method | Fresh form per payment; explicit method selection | Prevents accidental reuse and assumed payment methods |
| Paid invoices still counted as outstanding | Balance-based unpaid metric | Aligns the dashboard with money still to collect |
| Weekend work is hard to review | Seven-day schedule | Supports service businesses working weekends |
| Dollar/rupee inconsistencies | One shared currency formatter with ISO code context | Makes amounts unambiguous |
| US-default address assumptions | Flexible local address and international phone examples | Avoids presenting a US-only form as a global form |

## Visual system

- Navy `#102F38` for navigation, teal `#087D70` for the primary action.
- Page background `#F5F7F8`, white surfaces, border `#E0E7E9`.
- Main text `#19343C`, secondary text `#61767D`.
- Mint for successful/active states; amber for waiting; red for field errors.
- System sans-serif, 26–30 px page titles, 14–17 px section headings, compact supporting labels.
- Rounded 8 px controls and 12–14 px surfaces. Stronger spacing between sections than within them.
- Text accompanies status colors. Inputs have labels. Dialogs use native modal focus behavior. Hidden mobile navigation is inert. Reduced-motion preferences are respected.

## Verification on September 22

- JavaScript syntax check passed using `node --check`.
- Browser walkthrough passed for job creation, multi-item selection, quantity adjustment, estimate preparation, simulated approval, starting/completing work, invoice issue, partial payment, full settlement, and payment history.
- Invalid job title and overpayment/missing payment method show field errors. Tested partial payments of 65 + 100 against a 165 invoice.
- Navigation checked for Jobs, Schedule, Customers, Estimates, Invoices, Services & parts, Reports, Preferences.
- Visual checks at 390, 768, 1024, and 1440 px. Tested form/document widths remained within the viewport. Desktop/Mobile review switch and screen selector were exercised.
- INR formatting was verified in report metrics and chart labels.
- Direct prototype navigation produced no captured JavaScript console errors during the navigation smoke test. A later review-wrapper session logged a MutationObserver error with no source location; the prototype contains no MutationObserver code and its device switch continued to work. The origin of that browser-session error was not established.
- No previous visual baseline exists, so visual regression comparison is **inconclusive**. These were visual inspections, not baseline image comparisons.

## Boundaries before production implementation

This is a UI prototype, not a production financial system. It intentionally uses native selects/datalist rather than Angular `ng-select`; the live implementation must use the repository's searchable reference controls. It does not include real permissions, tenancy, audit, idempotency, tax calculations, FX conversion, refunds, immutable document snapshots, concurrency, SMTP, or PDF generation. Currency changes relabel sample values; they do not convert money. Historical chart data and recent-activity examples are illustrative.

There is no remote loading or network-failure state because this preview has no API. Loading, retry, empty, permission-denied, conflict, offline, and delivery-failure states must be included when integrating the design. Empty search/schedule/payment-history and field validation states are represented here. Browser keyboard checks and labels are not a full accessibility conformance audit.

Angular/API build and SQL checks were not rerun for this standalone artifact: no application source, database schema, or API behavior was changed. The separate [browser audit findings](../browser-audit-2026-09-21.md) remain implementation work.

## Self-evaluation

The agent-self-evaluation skill was used for the deliverable review.

| Axis | Score | Evidence / remaining limit |
|---|---|---|
| Accuracy | 4/5 | Verified 165 total and 65 + 100 settlement; money and document behavior are explicitly simulated. |
| Completeness | 4/5 | Requested screens and supporting financial flow included; production-only states require integration work. |
| Clarity | 4/5 | Device and screen switches make review direct; supporting labels could be further tested with real owners. |
| Actionability | 4/5 | Runnable local files and a complete clickable walkthrough; not yet Angular components. |
| Conciseness | 4/5 | Main screens emphasize one next action; the integration notes are intentionally detailed. |

Overall: **4.0/5**. Deliver for design review. Highest-value next steps: user review on a real phone, then Angular integration with meaningful state/permission tests and accessibility verification. The assessment matches the agreed prototype-first scope.
