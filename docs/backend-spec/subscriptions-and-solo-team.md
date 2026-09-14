# Subscription and solo/team rules — proposed v1 defaults

Pricing and final commercial terms are not yet approved. No production plans or prices are seeded. Publish versioned plan rows only after confirming prices, seat counts, quotas and provider price IDs.

## Entitlements

| FeatureCode | Interpretation |
|---|---|
| staff.seats | Active members including all owners + unexpired Pending invitations. |
| storage.bytes | Ready files + pending upload reservations; rejected/expired reservations release space. |
| jobs.per_period | Jobs created during the subscription billing period, including later-cancelled jobs. Deleting/archiving must not reset usage. |
| estimates.enabled | Boolean availability of estimates. |
| reports.enabled | Boolean access to expanded reports. |

`LimitValue = NULL` means unlimited; zero means no allowance; `Enabled=0` disables the feature. A missing entitlement fails closed. Basic owner data export remains available during billing ReadOnly/Ended retention, independent of premium report access.

`DisplayText` is customer-facing plan copy shown by Angular, such as `1 staff seat` or `Advanced reports disabled`. It does not control access. `FeatureCode`, `Enabled` and `LimitValue` remain the authoritative enforcement fields. Update the display text whenever those values change.

Example Solo-plan entitlements:

```sql
DECLARE @SoloPlanId uniqueidentifier = 'PLAN-GUID-HERE';

INSERT INTO platform.PlanEntitlements
    (PlanId, FeatureCode, Enabled, LimitValue, DisplayText)
VALUES
    (@SoloPlanId, N'staff.seats',              1, 1,          N'1 staff seat'),
    (@SoloPlanId, N'storage.bytes',            1, 1073741824, N'1 GB storage'),
    (@SoloPlanId, N'jobs.per_period',          1, 100,        N'100 jobs per billing period'),
    (@SoloPlanId, N'estimates.enabled',        1, NULL,       N'Estimates enabled'),
    (@SoloPlanId, N'reports.advanced.enabled', 0, NULL,       N'Advanced reports disabled'),
    (@SoloPlanId, N'exports.enabled',          1, NULL,       N'Data export enabled');
```

Proposed plans are Solo (1 seat) and Team (configured seat limit); prices and limits other than the Solo seat are decisions to configure. Do not hardcode these in Angular. Trial: proposed 14 days, one seat unless another trial entitlement set is explicitly configured.

## Subscription states

| State | Access |
|---|---|
| Trialing | Allowed features through TrialEndsAt, subject to trial quotas. |
| Active | Allowed features through paid period; cancellation-at-period-end does not end access early. |
| PastDue | Proposed 7-day grace from first failed renewal; existing subscription entitlements remain during grace. Retries do not restart grace. |
| ReadOnly | After trial/grace expiry: view existing records and owner export/billing recovery; no operational writes. |
| Ended | After cancellation period ends: owner read/export for proposed 30-day retention window; billing and reactivation remain available. |

Document retention is separate from subscription state. Proposed retention periods require product approval before launch. Notify the owner before deletion; account data must not disappear immediately after a failed payment or downgrade. Legal/accounting retention requirements, if applicable, must be configured separately.

Business Suspended overrides ordinary access; an operations administrator records a reason and restores access explicitly. Do not confuse admin suspension with nonpayment. Closed/DeletionPending block normal operational activity.

Trialing → Active/ReadOnly; Active → PastDue/Ended; PastDue → Active/ReadOnly/Ended; ReadOnly → Active/Ended; Ended → a new subscription after reactivation. Keep history and exactly one current subscription. Provider status maps into these internal states in an adapter; do not expose provider-specific enums throughout the application.

## Safe billing processing

- Create checkout using the authorized business and published plan; use server-configured return URLs.
- Verify signature over raw webhook bytes before trusting the event. Persist `(Provider, ProviderEventId)` uniquely and acknowledge only after durable receipt.
- Resolve business through the stored provider customer/subscription mapping, never arbitrary webhook metadata alone. Quarantine unmatched events.
- Deduplicate and reconcile out-of-order events against provider state; old events must not reactivate an ended subscription or undo a successful renewal.
- Never activate a paid plan based on a browser success redirect.
- Upgrades apply after provider confirmation. Preview any proration; final charge comes from the provider.
- Downgrades are scheduled for period end and revalidated then. If usage still exceeds target limits, mark the change Blocked and notify the owner; do not silently delete records, remove staff or apply an undisclosed paid renewal. Restrict to owner recovery/read-only if the old paid entitlement ends before resolution.

## Solo → team

1. Owner selects Invite member; check team/seat eligibility.
2. Under a per-business transaction lock, expire old invitations, count active seats plus live reservations, and check the limit.
3. Create Pending invitation with a cryptographic random token stored only as SHA-256, proposed 7-day expiry, role Manager/Technician. Insert an outbox email in the same transaction.
4. Acceptance requires an authenticated user with matching verified normalized email. Lock invitation and business; revalidate expiry, membership, subscription and seat reservation; activate/reactivate membership and consume invitation atomically.
5. First additional active member reveals team scheduling and assignment controls. Existing jobs stay assigned to the owner. A team-ready invitation can be shown before acceptance.
6. Never accept an invitation into a lower plan that no longer supports the seat. Return a recoverable conflict and release/revoke the reservation by policy.

Use one serialization strategy consistently, e.g. `sp_getapplock` resource `seats:<BusinessId>` with transaction ownership, or a locked business row. Invitation creation, acceptance, reactivation, ownership changes and downgrades all acquire that lock. In-memory counters alone are insufficient.

## Team → solo

Preview returns active additional members, pending invitations, open jobs, future appointments and blockers. Commit requires a fresh business rowversion and rechecks the preview inside a transaction; never trust a list of counts supplied by the browser.

- Retain one active owner as the solo worker. Require ownership resolution if other owners exist.
- Reassign unfinished jobs and future appointments to that owner; identify scheduling conflicts for explicit owner resolution.
- Stop/resolve open timers and preserve original time entries, authorship, completion history and document records.
- Deactivate additional memberships and revoke all pending invitations. Revoke their active business sessions/refresh grants and invalidate authorization caches.
- Staff removal affects this business only; their global user account and other memberships remain valid.
- Recompute entitlements, then request a lower plan if eligible. Becoming solo does not automatically change billing.
- History references inactive memberships. Do not cascade-delete staff or create a new business ID.

Solo/team is derived workspace presentation. `experiencePreference` is onboarding intent, not an entitlement or security bypass. At least one active owner must remain; ownership transfer is a dedicated transactional command.
