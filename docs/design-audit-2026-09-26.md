# ServiceDesk design review — 26 September 2026

Reviewed the running Angular app after authorized Google sign-in. The account already had a workspace; no new account or business records were created during this review.

## Changes applied

| Severity | Finding | Change |
| --- | --- | --- |
| Major | Selected searchable dropdowns hid their input with `display:none`, preventing replacement searches. | Preserve the focusable input; hide its empty text visually until typing. Verified searching and changing an existing arrival window on mobile and observing the updated summary. |
| Major | Hidden mobile navigation could remain keyboard reachable; background controls remained interactive while open. | Hide closed drawer from visibility, make background inert while open, move focus to Close menu after rendering, restore menu focus on Escape. |
| Minor | Small menu touch targets and missing bottom-navigation focus outline. | Minimum 44px menu controls and visible keyboard focus. |
| Major | Dashboard described historical rows as today's jobs and counted settled issued invoices as outstanding. | Accurate labels: Recent jobs and Issued invoices. Removed database implementation details from customer-facing copy. |
| Major | Invoice request failure displayed zero financial totals and zero invoices. | Suppress unavailable totals and label the list unavailable, with existing retry action. Added a regression test. |
| Minor | Header search, help, and notifications looked interactive but had no action. | Search now links to the searchable Jobs page. Removed inactive help/notification controls and misleading keyboard shortcut. User initials are informational; sign-out remains available in navigation. |

## Verification

- Desktop dashboard inspected; at 1440px sidebar stayed at top 0 after scrolling and document width did not exceed viewport.
- 390px: job cards, create-job form, selected arrival-window search, mobile drawer, invoice list, and approved estimate detail inspected through live UI and DOM.
- 390px: customers, schedule, catalog, reports, and settings loaded without displayed error banners or page-level horizontal overflow in sampled states.
- 768px: invoice/estimate list layout sampled. 1024px: estimate detail sampled. Measured document width stayed within viewport.
- Mobile drawer: Close menu receives focus, background is inert, drawer z-index 1000 is above backdrop 999, Escape returns focus to Open menu.
- Invoice list initially returned a generic financial server error, then succeeded on retry: seven invoices, one draft, six settled issued invoices. Root cause of that intermittent server failure was not established; no claim that backend failure is fixed.
- Angular tests: nine passed, including unavailable invoice totals regression. Production build passed with budget warnings.
- .NET formatting verification with `--no-restore`, build, and existing domain/integration test executable passed.

## Further improvements

1. Investigate intermittent financial API failures using server trace IDs and logs. Invoice retry recovered during this review; repeated reliability testing remains necessary.
2. Reduce the initial Angular bundle (about 865kB raw versus 500kB warning budget), primarily through lazy loading feature routes. Shell component styles also exceed their warning budget.
3. For global deployment, review workspace-local dates and explicit currency formatting. This review did not certify all currencies, time zones, accessibility criteria, or the entire create-to-payment state-transition flow.

## Review self-evaluation

Accuracy 4/5: fixes and checks have source/test/browser evidence; intermittent API cause remains unknown.
Completeness 3/5: sampled design and responsive behavior, not every financial transition or global locale.
Clarity 4/5: separates applied changes from recommendations and verification limits.
Actionability 4/5: implementation and regression test supplied; server investigation still needed.
Conciseness 4/5: report keeps operational details in one artifact.
Overall 3.8/5. Highest-impact follow-ups: financial reliability and bundle reduction.
