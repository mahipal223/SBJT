# ServiceDesk project index

Indexed source: `D:\TempDebug\SBJT`

The complete ServiceDesk repository was moved into this workspace on September 11, 2026.

## Product

ServiceDesk is a multi-tenant SaaS job tracker for plumbers, electricians, automotive service shops, and similar US service businesses. A workspace may move between solo and team use without moving data. Tenant data is isolated by `BusinessId` and SQL Server row-level security.

## Technology and architecture

| Area | Technology | Primary location |
| --- | --- | --- |
| Frontend | Angular 22, TypeScript 6, RxJS | `src/ServiceDesk.Web` |
| HTTP API | ASP.NET Core 10 controllers | `src/ServiceDesk.Api` |
| Application contracts | Commands, DTOs, permissions, interfaces, rules | `src/ServiceDesk.Application` |
| Domain | Shared business enums and tenant abstractions | `src/ServiceDesk.Domain` |
| Infrastructure | SQL Server services, `BaseDAL`, tenant context | `src/ServiceDesk.Infrastructure` |
| Database | SQL Server 2019+ / Azure SQL | `outputs/backend-spec` |
| Tests | Executable domain and tenant checks | `tests/ServiceDesk.Api.Tests` |

The backend is a modular monolith. Dependencies point inward: API and Infrastructure use Application; Application uses Domain.

## Repository map

```text
ServiceDesk.slnx
AGENTS.md                         repository implementation rules
README.md                        phase status and local setup
src/
  ServiceDesk.Api/
    Authentication/              development authentication
    Controllers/                 HTTP endpoints
    Middleware/                  tenant membership resolution
    Security/                    permission policies
    Tenancy/                     configured development memberships
  ServiceDesk.Application/
    Abstractions/                tenant and membership interfaces
    Financials/                  estimate, invoice, and payment contracts
    Security/                    tenant context and permission constants
    Work/                        customer, job, catalog, and job-item contracts
  ServiceDesk.Domain/
    Businesses/                  industry and business status enums
    Common/                      tenant-owned marker
    Identity/                    business roles
  ServiceDesk.Infrastructure/
    Data/BaseDAL.cs              central SQL connection/query/transaction helper
    Services/WorkService.cs      customers, jobs, catalog, line items, job status
    Services/FinancialService.cs estimates, invoices, issue/send, payments
    Tenancy/                     scoped tenant context storage
  ServiceDesk.Web/
    src/app/core/                authentication, interceptors, typed API service
    src/app/features/            live work, catalog, financial, and prototype pages
    src/app/layout/              responsive desktop/mobile shell
    src/styles.scss              global design system and responsive styles
tests/
  ServiceDesk.Api.Tests/         executable business-rule checks
outputs/
  backend-spec/                  SQL, OpenAPI, roles, rules, relationships, docs
  phase-*.md                     implementation reports
work/                            database/setup/build/validation helpers
```

## Implemented API surface

All tenant routes use `/api/v1/businesses/{businessId}` and require an active membership plus a named permission.

| Feature | Routes |
| --- | --- |
| Health | `GET /health/live`, `GET /health/ready` |
| Identity | `GET /api/v1/me` |
| Workspace | `GET /api/v1/businesses/{businessId}/workspace` |
| Customers | list, read, create under `/customers` |
| Jobs | list, read, create, change status, get/replace items under `/jobs` |
| Catalog | list and create under `/catalog-items` |
| Estimates | list, create from a job, send |
| Invoices | list, create from a completed job, issue, record payment |

The main controller files are `CustomersController.cs`, `JobsController.cs`, `CatalogController.cs`, and `FinancialsController.cs`. Controllers are thin; SQL and business work are owned by Infrastructure feature services through Application interfaces.

## Frontend route modules

| Route group | Pages |
| --- | --- |
| Authentication | `/login` |
| Work | `/app/overview`, `/customers`, `/customers/new`, `/customers/:id`, `/jobs`, `/jobs/new`, `/jobs/:id`, `/schedule` |
| Money | `/catalog`, `/estimates`, `/invoices`, `/reports` |
| Management | `/team`, `/subscription`, `/settings`, `/admin` |
| Field workflow | `/technician` |

Live SQL/API pages currently cover customers, jobs, catalog, estimates, and invoices. Several management, schedule, report, admin, and technician screens remain presentation prototypes.

## Database index

- 47 tables across `auth`, `platform`, and `app` schemas.
- 36 SQL row-level security policies use `SESSION_CONTEXT(N'BusinessId')`.
- Restricted runtime role: `servicedesk_app`.
- Core tenant aggregates: members, invitations, subscriptions, customers, locations, assets, jobs, appointments, catalog items, job items, estimates, invoices, payments, files, exports, audit events, outbox messages, and idempotency records.
- Platform aggregates: businesses, plans, plan entitlements, administrators, webhook events, backups, restores, and administrator audit events.

Apply scripts in this order:

1. `outputs/backend-spec/01-schema.sql`
2. `outputs/backend-spec/02-tenant-security.sql`
3. `outputs/backend-spec/03-reference-data.sql`
4. `outputs/backend-spec/04-document-guards.sql`
5. `outputs/backend-spec/05-isolation-smoke-tests.sql`
6. `outputs/backend-spec/06-development-data.sql` for local development only

## Tenant, permission, and subscription boundaries

- `TenantResolutionMiddleware` authenticates the user and resolves an active membership for the route business.
- `TenantContext` supplies validated `BusinessId`, `UserId`, `MemberId`, role, and permissions.
- `BaseDAL` writes the business ID into SQL `SESSION_CONTEXT` for every tenant connection.
- Missing and cross-tenant resources use the same generic not-found behavior.
- Central permission constants include workspace, team, subscription, customer, job, catalog, estimate, invoice, and payment permissions.
- Plan enforcement reads `platform.PlanEntitlements`; `DisplayText` is presentation only.
- The seeded Solo plan has one seat, 1 GB storage, 100 jobs per billing period, estimates and exports enabled, and advanced reports disabled.

## Implemented business workflows

1. Create/search/read customers.
2. Create scheduled or unscheduled jobs and enforce the period job limit.
3. Add catalog services, labor, and parts.
4. Replace job line items while the server recalculates totals and stores price snapshots.
5. Move jobs through validated status transitions; completion requires at least one line item.
6. Create and send estimates from frozen job/customer snapshots.
7. Create an invoice only after job completion, issue it, and record a payment with overpayment protection.
8. Persist audit events for operational and financial state changes.

## Important entry points

| Purpose | File |
| --- | --- |
| Application startup | `src/ServiceDesk.Api/Program.cs` |
| Service registration | `src/ServiceDesk.Api/Extensions/ServiceCollectionExtensions.cs` |
| Shared SQL helper | `src/ServiceDesk.Infrastructure/Data/BaseDAL.cs` |
| Work implementation | `src/ServiceDesk.Infrastructure/Services/WorkService.cs` |
| Financial implementation | `src/ServiceDesk.Infrastructure/Services/FinancialService.cs` |
| Work contracts | `src/ServiceDesk.Application/Work/WorkContracts.cs` |
| Financial contracts | `src/ServiceDesk.Application/Financials/FinancialContracts.cs` |
| Permissions | `src/ServiceDesk.Application/Security/Permissions.cs` |
| Angular routes | `src/ServiceDesk.Web/src/app/app.routes.ts` |
| Angular API client | `src/ServiceDesk.Web/src/app/core/work-api.service.ts` |
| Global responsive UI | `src/ServiceDesk.Web/src/styles.scss` |
| Database overview | `outputs/backend-spec/README.md` |
| API conventions | `outputs/backend-spec/api-conventions.md` |
| Endpoint contract | `outputs/backend-spec/api-endpoints.md` and `openapi.json` |

## Local run and validation

```powershell
$env:ASPNETCORE_ENVIRONMENT='Development'
dotnet run --project src/ServiceDesk.Api
npm --prefix src/ServiceDesk.Web start
```

Frontend: `http://localhost:4200`  
API: `http://localhost:5080`  
SQL setup: `work/configure-local-sql.ps1`

Required checks from `AGENTS.md`:

```powershell
dotnet format ServiceDesk.slnx --verify-no-changes
dotnet build ServiceDesk.slnx --no-restore
dotnet run --project tests/ServiceDesk.Api.Tests --no-build
npm --prefix src/ServiceDesk.Web run build
npm --prefix src/ServiceDesk.Web test -- --watch=false
```

## Current implementation gaps

- Production OIDC provider is not selected; authentication and membership lookup are development configuration based.
- Automated SQL integration coverage for RLS, concurrency, idempotency, and financial workflows is incomplete.
- Phase 4 endpoints, Angular pages, README status, and implementation report are complete.
- Invoice PDF/email delivery, estimate acceptance/revision, refunds, credit notes, and production payment-provider webhooks remain future work.
- Several Angular management screens still use prototype data.
- The repository has no initial Git commit; all files are currently untracked.

## Index statistics

- 108 source/specification files, excluding dependencies and build outputs.
- 34 C# files.
- 18 Angular/TypeScript files.
- 7 SQL scripts.
- 18 Markdown specifications/reports.
- 5 .NET projects in `ServiceDesk.slnx`.
