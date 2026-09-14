# ServiceDesk backend specification

**Stack:** Angular frontend, ASP.NET Core Web API, SQL Server 2019+ or Azure SQL Database. This is a database-and-contract package, not an implemented API.

## Start here

| File | Purpose |
|---|---|
| `01-schema.sql` | 47 tables, tenant-safe foreign keys, unique keys, status checks, decimal fields, rowversion and indexes. |
| `02-tenant-security.sql` | Tenant RLS filter/block policies and a restricted business application role. |
| `03-reference-data.sql` | Owner/Manager/Technician roles and permission seeds. |
| `04-document-guards.sql` | Job transition and financial document protection triggers. |
| `05-isolation-smoke-tests.sql` | Rollback-only fixture tests for a dedicated verification database. |
| `relationships.md` | Mermaid relationship diagrams grouped by domain. |
| `data-dictionary.md` | Table columns and constraints. |
| `openapi.json` | 104 API operations and 110 schemas in OpenAPI 3.0.3. |
| `api-endpoints.md` | Readable endpoint/DTO/permission index. |
| `api-conventions.md` | Authentication, HTTP, concurrency, errors, pagination and idempotency. |
| `roles.md` | Role-permission matrix and resource restrictions. |
| `status-and-financial-rules.md` | Job/estimate/invoice transitions and money calculations. |
| `subscriptions-and-solo-team.md` | Subscription lifecycle, seat reservations, upgrades and team changes. |
| `tenant-boundaries.md` | Request, database, file, worker, cache and administrator boundaries. |
| `implementation-checklist.md` | Enforcement responsibilities and acceptance scenarios. |
| `verification.md` | Actual checks performed and verification limitations. |

## Apply scripts

Create a NEW EMPTY development database using your normal SQL Server administration process. These scripts do not create, drop or overwrite a database. Run 01, 02, 03, then 04 in order with a migration principal; stop at the first error. They are initial migrations, not repeatable synchronization scripts. Later changes need new versioned migrations.

```powershell
sqlcmd -S '.\SQLEXPRESS' -E -b -d ServiceDeskDev -i 01-schema.sql
sqlcmd -S '.\SQLEXPRESS' -E -b -d ServiceDeskDev -i 02-tenant-security.sql
sqlcmd -S '.\SQLEXPRESS' -E -b -d ServiceDeskDev -i 03-reference-data.sql
sqlcmd -S '.\SQLEXPRESS' -E -b -d ServiceDeskDev -i 04-document-guards.sql
```

The commands assume this directory is current and a working integrated-authentication connection. Use environment-appropriate authentication/TLS configuration. Do not embed production credentials in scripts. For Azure SQL, create the database separately and use the intended managed identity/service principals.

Run the same scripts in a disposable database named `ServiceDeskSpecTest...`, then run `05-isolation-smoke-tests.sql`. The test script refuses other database names and rolls back its fixtures. It is not a replacement for tests using the real restricted runtime principal.

Keep provisioning/auth/admin credentials separate from `servicedesk_app`. Add the runtime database user to that role only after implementing the tenant context and authorization pipeline. RLS denies tenant access when context is missing. Deployment-specific service principals/procedures are intentionally not provisioned by these scripts.

## Key design choices

- A user may belong to several businesses. A membership carries its business role.
- Solo and team use the same BusinessId and records. No migration is performed when staffing changes.
- Tenant child primary keys are `(BusinessId, Id)`. All corresponding relationships include BusinessId; jobs also tie locations/assets to the selected customer.
- No cascading deletion. Archive entities and deactivate staff so history remains intact.
- Update `UpdatedAt` explicitly in application services; SQL rowversion changes automatically on row updates. Child writes must also bump the aggregate parent.
- Global reference/control-plane tables do not become tenant data merely because an administrator uses them. Control-plane access is separately authorized.
- Job totals and financial/report projections are calculated. Invoice snapshots and their issued totals are stored and protected.
- Full inventory, dispatch optimization, service bays, accounting integrations and online customer card charging are deferred extensions. A shared service workflow, assets and validated industry JSON are included.
- SQL Server Express has no running SQL Agent job scheduler in this environment. Schedule application background work and backups through the chosen host/worker infrastructure; the metadata tables do not execute backups.

## Required configuration before launch

Identity issuer, subscription billing provider, email provider, private storage, published plan prices/limits, tax settings, retention schedule and operational recovery objectives. Trial/grace/export defaults in the rules are proposed product decisions, not legally mandated periods.

## Verification status

All five SQL files passed Microsoft SQL Server ScriptDom parsing. The OpenAPI document passed Microsoft.OpenApi parsing without errors or warnings. Additional schema/reference checks are recorded in `verification.md`.

Database execution was **not completed**: local SQL Server connection attempts failed with Windows SSPI/credential errors. Do not treat parser checks as successful migration execution, RLS tests or API integration tests. No existing database was modified.
