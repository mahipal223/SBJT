# Phase 1–4 browser QA — September 11, 2026

Status: in progress. Phase 5 approval/revision workflows are excluded.

## Environment

- Angular at http://localhost:4200; API at http://localhost:5080.
- API readiness confirms real SQL connectivity.
- SQL principal verified as `servicedesk_runtime`, neither `db_owner` nor `sysadmin`.
- A connection with no tenant context returns zero customer rows.
- Initial checks used the Codex browser. At the user's request, subsequent QA switches to local browser-use in `work/browser-use-qa`.
- Browser-use local Chrome connection verified through CDP on `127.0.0.1:9223`; it navigated to `/login`, clicked demo login, and inspected `/app/overview`.

## Records created by this run

- Customer `QA P1-4 20260911 Customer`: `6cfebe44-bd73-46ad-abd4-e02f6b019218`.
- Job `J-0006`, `QA P1-4 Scheduled workflow`: `48bc3174-fd62-48f1-9f31-71e652eee9f9`.
- Catalog: `QA P1-4 Service` ($125.25), `QA P1-4 Labor` ($80/hour), `QA P1-4 Part` ($25.50).
- Email uses the reserved `.invalid` domain; no external email or actual payment is authorized.
- Existing records are not modified or deleted.

## Initial results

| Check | Result |
| --- | --- |
| Demo login and guarded shell | Pass |
| Empty customer form | Required-field message returned by API |
| Customer creation, detail, refresh persistence | Pass |
| Scheduled job creation and solo assignment | Pass |
| Scheduled → InProgress | Pass |
| Complete a job without items | Correctly rejected |
| Service, labor, part creation | Pass; independently confirmed via API |
| Anonymous API / foreign business / missing customer | 401 / generic 404 / generic 404 |
| Invalid job transition | 422 invalid_transition |

## Fixes under verification

- Suppress misleading “ready for API connection” prototype toast on live actions.
- Associate customer, job, and catalog labels with their controls.
- Preserve both arrival-window times instead of always storing 90 minutes; reject malformed/reversed windows. Existing appointments are not changed.
- Validation pass found and fixed server-side customer email validation. The visible UI still maps the structured invalid-arrival-window response to a generic message and should be improved to display its `detail` consistently.

## Scope limitations

Overview metrics, sidebar badges, plan usage, and schedule calendar are prototype data. Their values do not prove persistence. Production OIDC, management screens, and Phase 5 are not part of this test run.
