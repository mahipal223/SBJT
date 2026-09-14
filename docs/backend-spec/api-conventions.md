# API contract conventions

`openapi.json` is OpenAPI 3.0.3 and can be imported into Swagger Editor/Postman or used for Angular client generation. The contract is design-first; no ASP.NET implementation is claimed. `api-endpoints.md` is the readable endpoint index.

## Transport, identity and validation

- HTTPS, JSON camelCase, `/api/v1`, UTC RFC3339 timestamps; business-local dates use YYYY-MM-DD. Store IANA time-zone IDs and verify the deployment supports converting them. UI displays US dates and USD amounts.
- Hosted OIDC authentication supplies tokens. Registration, login, MFA and password recovery are identity-provider flows, not hand-built password tables in the domain schema. Provider selection is an implementation decision; Angular should use authorization-code flow with PKCE.
- Use request DTOs, never EF entities. Reject unexpected JSON properties and enforce lengths, email/phone/address validation, positive quantities, bounded monetary values and field-specific authorization.
- PATCH uses ordinary partial JSON, not JSON Patch. Omitted means unchanged; nullable clearing must be explicit in the final DTO. Reject empty updates. PUT child collections replace the whole collection and require parent If-Match.
- Customer fields such as email are optional; omitted optional response properties mean not provided. Do not expose another user's token or any invitation/public-link hash.

## Concurrency and idempotency

- Return `version` and `ETag: "<base64-rowversion>"` on entity reads/writes. Require If-Match on updates and state commands. Missing → 428; stale → 412. Do not accept wildcard If-Match for business mutations.
- Child item/assignment/checklist replacement and payment/credit commands target the parent aggregate version. In the transaction update parent UpdatedAt so SQL bumps its rowversion even when only children changed.
- Default idempotency retention: 24 hours; financial/provider event IDs are retained for deduplication independently of this TTL. Key scope is business + actor + operation + key. Store canonical request hash and completed status/body. Same key/different hash → 409; in-flight duplicate → 409 with retry guidance; exact completed retry returns original response.
- Business creation and invitation acceptance occur before an ordinary tenant scope exists. Use a separate identity-service idempotency store keyed by authenticated subject + operation + key, not the tenant IdempotencyRecords table.
- Public estimate decisions use token/document scope and the unique decision constraint for deduplication; exact retries return the same decision, conflicting decisions return 409.
- Require the same identity and present-day permission to read a cached idempotent response. Never leak a previously cached response to a removed staff member.

## Collections and asynchronous work

- Default page size 25, maximum 100. Opaque signed cursor binds tenant, normalized filters and deterministic sort `(CreatedAt, Id)`. `nextCursor=null` ends pagination. Define case-insensitive search fields per endpoint; do not accept raw SQL sort expressions.
- Date range is inclusive `from`, inclusive `to` interpreted in business time zone; convert to UTC `[startOfFrom, startOfDayAfterTo)` for queries. Maximum report range 366 days for synchronous reports; larger work is an export.
- 201 indicates a created resource; 202 indicates queued work. Async responses include a statusUrl to the corresponding export/document/operation status resource. Outbox drives email/PDF actions. Do not mark DeliveryStatus Sent until the delivery provider confirms acceptance.
- Draft invoice PDFs are watermarked Draft. Export/download tickets expire and must not be publicly cached.

## ProblemDetails codes

| HTTP | Stable code examples |
|---|---|
| 400 | validation_failed, malformed_request |
| 401 | authentication_required |
| 403 | permission_denied, subscription_read_only, feature_unavailable |
| 404 | resource_not_found |
| 409 | seat_limit_reached, assignment_conflict, last_owner, downgrade_blocked, idempotency_conflict, invoice_already_exists |
| 412 | version_conflict |
| 422 | invalid_transition, invoice_total_mismatch, overpayment, refund_exceeds_payment |
| 428 | if_match_required |
| 429 | rate_limited |

Unexpected errors return a trace ID; never SQL messages, connection strings, tokens, stack traces or another business's identifiers.

## DTO/SQL mapping

`Member.role` maps to Members.RoleCode; `LineInput` is priced and taxed server-side into line tables; `version` maps to Version. `businessId` comes from validated scope and is deliberately absent from create DTOs. Payment status and dashboard fields are computed, not editable database columns. API document responses compose header and item rows. `JobWorkView` is a separate projection for technicians.

`PlanEntitlement.displayText` is presentation copy only. Authorization and quota checks must use `featureCode`, `enabled` and `limitValue`; never parse or trust display text when enforcing a plan.

## Contract decisions still needed before provider integration

Choose identity issuer, subscription payment provider, email/storage providers and production plan prices. Provider webhook and hosted checkout adapters are intentionally generic until those choices are made. This does not block customer/job CRUD implementation.

Specification format reference: [OpenAPI 3.0.3](https://spec.openapis.org/oas/v3.0.3.html).
