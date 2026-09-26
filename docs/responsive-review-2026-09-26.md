# Responsive and usability review — 26 September 2026

## Screenshot follow-up fixes

## Dashboard redesign

Implemented a simpler owner-focused dashboard: four linked summary cards, unpaid balance as the main invoice value, a restrained navy revenue card, five recent jobs with full-row links, and useful schedule/customer/billing/report shortcuts. Removed the dense table and nested quick-action cards. Mobile uses two summary columns and stacked jobs; desktop uses four metrics and side-by-side jobs/shortcuts. Failed refreshes retain the previous overview with an explicit stale-data notice, and duplicate refresh requests are blocked.

Measured actual CSS viewport widths 320, 390, 767, 1024, and 1440 after compensating for browser zoom. All five samples had no page overflow or clipped dashboard links/buttons. Visually inspected phone and desktop; verified white revenue text against the navy background. Eleven Angular tests passed, including duplicate-refresh and failed-refresh coverage. Required .NET checks and production build passed; existing build-size warnings remain. Physical devices and Safari were not tested. Final optional invoice-link click was not completed because the browser had moved to Schedule; do not treat every shortcut as click-tested.

Self-evaluation: accuracy 4/5 (measurements and tests recorded); completeness 4/5 (dashboard responsive scope covered, hardware/browser testing remains); clarity 4/5 (plain business labels); actionability 4/5 (implemented and reviewable); conciseness 4/5 (simplified dashboard information). Next validation: physical phone and Safari.

Additional user feedback: removed the jobs-shown/workspace-local footer and normal estimate/invoice list counts. Search and Refresh now share one phone toolbar row. Mobile jobs, customers, catalog, estimates, and invoices use separate filter panels and individual row cards, without a surrounding second card border. Visually verified customer/job/estimate screens and measured matching search/Refresh top coordinates at the narrow phone setting. Desktop tables retain their existing presentation.

The user's screenshots revealed clipping inside customers/catalog tables even though the document width stayed within the viewport. Those lists now use labelled mobile cards, preserving contact/address and all catalog price/tax fields. Search/filter toolbars use a consistent grid, with Refresh beside financial status filters; job search has a 44px container. Report period buttons use a two-column phone grid.

Mobile Schedule now shows a seven-day agenda, including every visit on each day rather than a clipped five-column grid. Week labels and desktop day headers include weekends. Date keys are formatted from local calendar fields rather than UTC conversion. A regression test verifies two simultaneous Saturday visits remain visible. Ten Angular tests pass.

Visually inspected corrected customer, catalog, and schedule screens. Rechecked seven screenshot-affected pages at five requested viewport sizes. Browser zoom was active: measured CSS widths differed from requested pixel widths (for example 355px and 433px for requested 320px and 390px), so these follow-up measurements are not exact breakpoint certification.

Invoice wording changed from “Net 14” to “Issue invoice · due in 14 days.” This means payment is due fourteen days after issue; payment behavior is unchanged.

## Scope

Reviewed the running local Angular app in Chrome using viewport emulation. Reused the previously authorized Google account. No jobs, customers, invoices, payments, or settings were saved during this review. Existing changes from the previous review were preserved.

## Device-size matrix

| Width | Representative use | Screens checked |
| --- | --- | --- |
| 320px | Narrow phone | 12 main screens |
| 390px | Typical phone | 12 main screens |
| 768px | Tablet portrait | 12 main screens |
| 1024px | Tablet landscape / small laptop | 12 main screens |
| 1440px | Desktop | 12 main screens |
| 844 × 390px | Phone landscape | Create-job item picker |

The 12 main screens are overview, jobs, create job, customers, schedule, estimates, invoices, catalog, reports, team, subscription, and settings. All 60 initial samples loaded their expected heading without a displayed error banner or page-level horizontal overflow. That alone did not establish usability: controls inside scrollable tables and filter strips were initially outside the phone viewport.

## Findings and applied fixes

| Finding | Severity | Resolution |
| --- | --- | --- |
| Phone invoice/estimate tables require sideways scrolling to reach actions. | Major | At 520px and below, rows become cards with visible field labels, customer details, financial values, and actions. Desktop/tablet retain tables. |
| Finance page heading and primary action compete in a cramped phone row. | Minor | Stack the heading and make the primary action full width on phones. |
| Completed/In progress job filters are hidden in a sideways-scrolling strip. | Minor | Wrap filters on phones and use 44px-high buttons. Tested Completed filter: seven completed jobs displayed. |
| Landscape item picker clips its footer below the visible modal. | Major | Use a flex column with a shrinking, scrollable body and fixed-size header/footer. At 390px viewport height the footer bottom measured about 366px; body scrolls independently. |
| Small modal controls and dropdowns are awkward to touch. | Minor | Increase key buttons/dropdown containers to at least 44px on phone/tablet widths; close and item-selection buttons also have a 44px minimum width. |
| Small form text is hard to read and can trigger focus zoom on mobile Safari. | Minor | Use 16px form text at mobile/tablet widths. Live create-job title input measured 16px. Safari behavior itself was not tested. |

## Post-change verification

- Rechecked jobs, estimates, invoices, and create job at all five widths: 20 samples, no detected page overflow or out-of-viewport main form/button controls.
- Visually inspected clipped Chrome screenshots before/after the mobile invoice layout.
- At 390 × 844px and page bottom, Create job button bottom was 765px, above mobile navigation at 781px.
- Verified 44px invoice status dropdown and wrapped 44px job filters.
- Production Angular build passed; nine Angular tests passed.
- .NET build and existing domain/integration checks passed. Formatting verification used `--verify-no-changes --no-restore`.

## Limits and remaining priorities

- This is Chrome viewport testing, not certification on every physical device or browser. iOS Safari, Android Chrome on hardware, software keyboard behavior, browser zoom, screen readers, and slow-network usability still need testing.
- No committed screenshot baseline exists: visual regression comparison is **inconclusive**. Current layout checks were performed directly.
- Full create-to-payment business transitions were not re-executed in this responsive review.
- Angular still reports initial bundle and shell-style budget warnings. Reduce feature loading costs before claiming consistently fast operation on low-end devices.
- The previous intermittent invoice API failure was not reproduced in this matrix; its backend cause remains unverified.

## Self-evaluation

Accuracy 4/5: browser measurements and build/test evidence support changes; hardware/browser coverage is limited.
Completeness 4/5: main screen matrix and key phone interactions covered; real-device and assistive-technology testing remain.
Clarity 4/5: tested states are separated from remaining checks.
Actionability 4/5: fixes applied, with specific remaining validation targets.
Conciseness 4/5: findings and limits consolidated here.
