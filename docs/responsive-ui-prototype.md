# ServiceDesk responsive UI prototype

The Angular application now includes a complete responsive design for a US service-business SaaS used by plumbers, electricians, auto service shops, and similar businesses.

## Included product areas

- Responsive application shell with desktop navigation, mobile drawer, and mobile bottom navigation
- Operations dashboard with jobs, estimates, invoices, revenue, and attention items
- Customer list, profile, service locations, and customer creation form
- Job list, creation workflow, work order detail, schedule, line items, and technician mobile view
- Service and parts price book
- Estimates, invoices, payments, and business reporting
- Solo-to-team membership experience, roles, permissions, invitations, and seat limits
- Subscription plan, usage meters, feature entitlements, and API limit-check explanations
- Business settings, US tax/currency defaults, security, audit, backup, and data export controls
- Platform administration for tenants, subscriptions, system health, and security events

## Design behavior

Desktop screens use a fixed workspace navigation and information-dense tables. Tablet and mobile layouts collapse grids into single-column cards, expose a slide-out navigation drawer, keep frequent actions reachable, and provide a dedicated technician job screen for field use.

The screens currently use representative mock data so product behavior and layout can be reviewed before each backend API is implemented. The existing development authentication remains in place.

## Responsive audit

Every application route was checked at 1440 × 900 desktop and 390 × 844 mobile viewports. The audit verified page headings, document width, table containment, sidebar state, mobile navigation, and browser console output.

- 17 application routes passed at both viewports
- No document-level horizontal overflow remains
- Wide data tables scroll inside their cards on small screens
- The technician job view hides workspace navigation to keep field actions focused
- Interactive controls retain usable touch sizes, apart from compact toggle controls
- Browser console: no errors or warnings

## Control-by-control audit

The browser audit exercised controls individually at desktop and mobile sizes:

- 12 desktop sidebar destinations passed
- 5 mobile bottom-navigation destinations passed with exactly one active item
- 25 in-page navigation actions passed
- 41 page buttons were clicked without runtime errors; backend-dependent actions show prototype feedback
- Customer, job, catalog, estimate, and invoice filters now use native select controls
- Mobile action controls are at least 44px high; bottom-navigation items are 48px high

Issues corrected during this audit:

- `/app/jobs/new` previously selected both **Jobs** and **New job** in the bottom bar
- Text-based dropdown arrows rendered as a cramped lowercase `v`
- The mobile menu and compact actions were smaller than the intended touch target
- Mobile action rows now prevent label wrapping and use full-width stacking inside cards when labels are long
- The selected bottom-navigation item now uses white text on teal for clear contrast
- Technician Back and overflow-menu controls now provide 44 × 44px touch targets

The final mobile control scan covered 152 visible controls across all 17 application routes. No text overflow or undersized action targets remain.

## Mobile navigation revision

The mobile bottom navigation now uses a floating rounded surface with a soft-teal active tab. The center **New job** action is raised in a circular teal button, giving the most frequent field action greater emphasis. The old solid selected block and vertical selection bar were removed, and touch-layout hover styles can no longer make two items appear selected.

The navigation now also has a concave curved notch around the center action. The **New job** circle is centered on the bar's upper edge, outlined against the white surface, and remains a 44px touch target. All five destinations retain independent selected states.

The notch uses a smooth custom path with short horizontal-to-curve transitions on its left and right sides, matching the supplied sketch without increasing the navigation height.

The final reference-style notch uses a shallow 110px filled SVG path with a subtle 1.5px outline. It flows smoothly around a 40px white circular action with a teal plus. Active tabs use teal icon and text without a large filled block, while the compact bar remains 58px high.

## Run locally

From `src/ServiceDesk.Web`, run `npm start`, open `http://localhost:4200`, and choose **Continue as demo owner**.
