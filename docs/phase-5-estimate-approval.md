# Phase 5 — Estimate approval and document detail

Implemented estimate and invoice detail workflow for Angular and ASP.NET Core, including secure expiring customer links, anonymous approve/decline responses, exact retry handling, estimate revision, and invoice detail screens.

Public tokens use `{BusinessId:N}.{randomSecret}`. Only the SHA-256 hash is stored in `app.PublicLinks`; the business prefix establishes tenant context and the hash must still match before data is returned. Links expire, are revoked on revision, and are consumed after a decision.

Validation: dotnet build, dotnet format verify, API domain checks (Phase 1 through Phase 4), Angular production build, and Angular tests (2 passed).

Next: provider-backed email delivery and idempotency keys for invoice issue and payment commands.
