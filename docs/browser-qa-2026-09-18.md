# Browser QA report — 18 September 2026

## Result

**Fix implementation completed; live data verification is blocked by the local SQL credential.** QA-01 and QA-03 through QA-07 were corrected and compiled. QA-02 was diagnosed as the configured `servicedesk_runtime` login being unable to open `ServiceDeskDev`; the repair script path was corrected, but credential rotation was not run because it requires the SQL administrator password. A completed customer → job → estimate → invoice workflow is still pending that local database repair.

### Fix status — 18 September 2026

| Finding | Status | Verification |
|---|---|---|
| QA-01 | Fixed | Onboarding now updates live auth state; tenant routes are guarded against a missing workspace ID. Browser sign-in used the stored ID and did not issue a `/businesses/null` request. |
| QA-02 | Configuration repair required | API log confirms SQL error 4060 for `servicedesk_runtime`. Run the corrected `work/configure-local-sql.ps1` with the SQL administrator password, then repeat the workflow. |
| QA-03 | Fixed | Sidebar uses the workspace name and removes fake counts; settings loads the business API; team shows only authenticated membership data and is hidden for a confirmed solo workspace. |
| QA-04 | Fixed | Schedule uses API jobs, routes by job ID, and no longer falls back to sample appointments. Browser showed an honest load error with no example jobs while SQL was unavailable. |
| QA-05 | Fixed | Client and API contract validate phone, two-letter state, and ZIP/ZIP+4. Browser showed inline errors and kept Continue disabled for malformed values. |
| QA-06 | Fixed | Browser accessibility state reported Just me selected and I have a team unselected. |
| QA-07 | Fixed | At 768 × 1024, Escape closed the drawer and restored focus to Open menu. |

Test target: `http://localhost:4200`. Tests ran interactively in the visible Codex browser panel. Chrome was not available through the connected browser inventory; this was not a Chrome/browser-use run. Google sign-in used an existing session; the user confirmed it was `indianpubg2@gmail.com` and authorized creating a QA workspace. The app did not independently display that email during this run.

QA workspace submitted: **QA Validation 20260918**, General Trade, Just me, phone `2025550147`, state `DC`, ZIP `20001`, America/Chicago. Creation navigated to overview. Persistence was not independently checked against SQL. No customers, jobs, invoices, payments, invitations, or external messages were created. No application code was changed.

Evidence consists of observed browser accessibility states, screenshots displayed during this session, and the source locations below. Screenshots were not saved as separate report attachments. Existing uncommitted source changes were left untouched. Source observations describe the working tree at test time and may differ from the running build.

## Findings

### QA-01 — High: onboarding does not activate the new workspace

**Steps:** Sign in as a user requiring onboarding → select General Trade → enter a business name and valid profile values → choose Just me → Create my workspace → Retry on overview.

**Actual:** Overview requests `/api/v1/businesses/null/dashboard/summary` and displays 404 Not Found. Retry repeats the same failure. Customers and jobs show “The server could not complete the request”; estimates and invoices show a financial-request error; catalog shows “Request failed”; reports explicitly requests `/businesses/null/reports/summary`.

**Expected:** Creating a workspace updates the shared authenticated tenant context before navigation; its empty dashboard and lists load successfully.

**Source evidence:** `src/ServiceDesk.Web/src/app/features/auth/onboarding.page.ts:431` writes only `sessionStorage`. `src/ServiceDesk.Web/src/app/core/auth.service.ts:13` initializes a signal from storage; its computed `businessId` does not automatically update when storage changes. `src/ServiceDesk.Web/src/app/core/work-api.service.ts:217` constructs API routes from that signal.

**Suggested fix:** Expose a tenant-context update method in AuthService and invoke it with the creation response before navigation. Guard tenant pages against missing context. Add a real first-login/onboarding integration test.

### QA-02 — High: workspace remains unavailable after reload

**Steps:** Following QA-01, reload overview; open Customers and Subscription.

**Actual:** Overview finishes loading with “The requested resource was not found.” Customers and Subscription show the same message. A reload does not restore usability.

**Expected:** A successfully created workspace should be accessible to its owner after reload.

**Diagnosis:** Confirmed separately as a recovery failure; it may share a cause with QA-01. The exact post-reload URL, response body, membership resolution, and SQL state were not captured, so a backend root cause is not established. Do not assume that updating the client signal alone fixes this symptom.

**Suggested investigation:** Trace the creation response, stored business ID, authenticated subject, owner membership, tenant resolution, and restricted SQL/RLS access together.

### QA-03 — High: new workspace displays hard-coded business and team data

**Steps:** Create the solo QA workspace → inspect sidebar → open Business settings and Team & permissions.

**Actual:** Sidebar says Northstar Services, Austin, TX, Team plan, 3 of 5 seats, AJ owner, Jobs 6, Invoices 3. Settings displays Northstar Services LLC and its example phone/address. Team displays Alex Johnson and three other example members, including an invitation. These are not the entered QA business details. Team navigation remains visible despite onboarding promising that solo mode hides team menus.

**Expected:** Display the selected workspace, authenticated user, real subscription/usage, and actual members. If these screens are prototypes, label them clearly and prevent them from appearing as live workspace data.

**Source evidence:** Hard-coded sidebar values in `src/ServiceDesk.Web/src/app/layout/app-shell.ts:20`; example members in `src/ServiceDesk.Web/src/app/features/management-pages.ts:226`; business profile values at line 266.

**Impact:** Misleading identity, usage, and membership information. The inspected source confirms demo values; this run does not establish a cross-tenant data leak.

### QA-04 — Medium: schedule events open an invalid job detail route

**Steps:** Open Schedule → click “Water heater inspection 8:00 AM · Alex”.

**Actual:** Navigates to `/app/jobs/detail`, then shows “The server could not complete the request.” Schedule shows example appointments even though the newly created workspace has no verified jobs. All observed appointment links use the same `detail` path.

**Expected:** Render actual scheduled jobs and link each event to its resource ID. A new workspace should show an empty schedule.

**Source evidence:** `src/ServiceDesk.Web/src/app/features/management-pages.ts:50` has the literal route; line 136 contains example schedule data.

### QA-05 — Medium: onboarding accepts malformed state/ZIP before advancing

**Steps:** On Business profile, enter a nonempty business name, state `INVALID`, ZIP `abc`, then Continue.

**Actual:** Advances to Team size without validation feedback. Returning to the profile retains those values. Automation set the state value directly, so this does not prove ordinary typing bypasses its two-character maxlength. The alphabetic ZIP is still a concrete invalid-format case. Phone text `abc` was cleared by the input, so phone acceptance is **not** reported as a confirmed defect.

**Expected:** Reject malformed optional fields when supplied, give inline guidance, and keep the user on the profile step.

**Source evidence:** `src/ServiceDesk.Web/src/app/features/auth/onboarding.page.ts` disables Continue only for an empty trimmed business name; ZIP has a length limit but no visible format rule.

**Boundary:** Invalid values were corrected before workspace creation. Automatic approval review blocked the attempted invalid-data submission because it could persist bad data. Server acceptance/rejection of malformed state/ZIP was not tested.

### QA-06 — Medium: team-size selection has invalid accessibility state

**Steps:** Reach Team size with the default Just me selection; inspect the accessibility tree and screenshot.

**Actual:** Visually only Just me is selected, but the accessibility representation reports both choices as selected (Value 1).

**Expected:** Assistive technology announces exactly one selection, consistent with the visual state.

**Source evidence:** `src/ServiceDesk.Web/src/app/features/auth/onboarding.page.ts` uses literal `aria-pressed="form.teamSize === 'solo'"` and `aria-pressed="form.teamSize === 'team'"`. These are expression strings, not bound boolean ARIA values.

**Suggested fix:** Bind `[attr.aria-pressed]` to booleans, or use a properly labeled radio group for the mutually exclusive choices.

### QA-07 — Medium: tablet navigation does not dismiss with Escape

**Steps:** At 768 × 1024, open the menu, then press Escape.

**Actual:** The drawer and dark overlay remain open; focus remains on Open menu. Clicking Close menu works.

**Expected:** Escape dismisses the modal navigation drawer and focus is managed consistently. Verify keyboard focus containment and restoration as part of the fix.

## Executed coverage

| Area | Result |
|---|---|
| Google sign-in | Reached onboarding through an existing session; account confirmed by user |
| Industry required selection | Continue disabled before selection, enabled after selection |
| Required business name | Continue disabled while blank |
| Onboarding navigation | Next/Back work; profile values retained |
| Workspace creation | Navigated to overview; shared context broken |
| Dashboard retry and reload | Both fail to recover a usable workspace |
| Customers list and new form | List fails; form renders; customer save not tested |
| Jobs list and new form | List and creation dependencies fail; no job submitted |
| Estimates and invoices | Loading errors; downstream document workflow blocked |
| Catalog | Loading error; no item submitted |
| Reports | Explicit null-workspace request failure |
| Schedule | Sample data displayed; event link fails |
| Settings and team | Example data displayed instead of QA identity |
| Subscription | Resource-not-found error after reload |
| Responsive UI | Sampled 390 × 844 overview, 768 × 1024 drawer, 1024 × 768 and 1440 × 900 subscription |
| Mobile overflow | Overview DOM width and scroll width both 390; no horizontal overflow detected on that screen |
| Tablet menu | Opens and closes via controls; Escape fails |

Responsive observations cover only the listed screens, not every page at every breakpoint. Browser viewport override was restored after testing. A console-error query returned no entries; this is not proof that the app has no JavaScript errors.

## Blocked or not tested

- Successful customer creation/edit, job scheduling/status changes, estimate approval, invoice issue/send, and payment workflows: tenant loading failures prevent meaningful verification.
- Direct server negative-validation tests: malformed onboarding submission blocked by automatic approval review; no workaround attempted.
- Tenant isolation, concurrency, stale versions, idempotency, role restrictions, admin module, exports, email delivery, and database persistence: not exercised in this run.
- No build or automated test suite was run; this was browser QA and a focused source inspection, not an implementation change.

## Recommended order

1. Repair workspace activation and diagnose the remaining post-reload resource failures.
2. Replace or clearly segregate example workspace, team, settings, and schedule data.
3. Correct validation, selection accessibility, and navigation keyboard behavior.
4. Repeat first-time onboarding, then complete a labeled customer → job → estimate → invoice test in the QA workspace. Capture request/status evidence and test server validation in an explicitly disposable environment.
