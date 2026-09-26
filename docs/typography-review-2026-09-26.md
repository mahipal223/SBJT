# Responsive typography review — September 26, 2026

Reviewed 18 signed-in business screens in Chrome at phone, tablet, laptop, and desktop widths (390, approximately 768, 1024, and 1440 CSS pixels): dashboard, customers, new customer, customer details, jobs, new job, job details, schedule, estimates, estimate details, invoices, invoice details, catalog, reports, team, subscription, business settings, and SMTP settings.

## Changes

- Shared page title scale: 22px on phones/tablets, 26px on smaller desktops, 28px on large desktops. Customer and job detail titles use 20px on phones to accommodate long names.
- Section headings use 16–18px; form labels use 13px; supporting captions and validation text use 12px.
- Buttons use 13–14px. Phone form inputs retain 16px text to avoid automatic browser zoom.
- Popup titles use 18px on mobile. Bottom navigation labels increased from 9px to 11px.
- Preserved full titles, wrapping, keyboard focus, and existing touch targets.
- Card captions wrap instead of being clipped; selected dropdown values no longer overlap their placeholders. Reduced the mobile subscription price size to 32px.
- Fixed the active New job navigation icon: its white plus remains visible over the teal background.

## Browser evidence

The 72 page/viewport checks found no document-level horizontal overflow. Headings followed the shared scale. The review caught and corrected 10px card captions, small settings hints, and an 11px create-job total label.

Customer/catalog bottom sheets and the services picker were also checked in the preceding popup review. Customer inline validation, dismissal, saved-event behavior, failed-save retention, and duplicate-submit protection were verified there.

## Scope limits

These are browser viewport checks, not certification on every physical device. Safari/iOS and Android hardware were not available. Authentication/onboarding typography was reviewed in source; onboarding and privileged platform administration were not exercised using the existing business account.
