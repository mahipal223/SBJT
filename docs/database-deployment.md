# SQL Server database deployment

Deployment completed on September 10, 2026.

## Target

- Server: `SHREEDHAR-221\SQLEXPRESS`
- Database: `ServiceDeskDev`
- Engine: SQL Server Express
- Login used for installation: SQL administrator login supplied interactively
- Password storage: the password was not written to source files, scripts, or this report

## Applied scripts

1. `01-schema.sql`
2. `02-tenant-security.sql`
3. `03-reference-data.sql`
4. `04-document-guards.sql`

## Verified result

| Database object | Count |
|---|---:|
| Application tables | 47 |
| Row-level security policies | 36 |
| Protection triggers | 5 |
| Application permissions | 20 |

The full isolation smoke suite was run in a separate `ServiceDeskSpecTest_Codex` database. It completed successfully, including tenant filtering, blocked cross-tenant inserts, composite foreign-key protection, status validation, invoice issue guards, and fail-closed behavior without tenant context. All fixture rows were rolled back and the verification database was removed afterward.

## Repeatable installer

`work/apply-database.ps1` prompts securely for the SQL password. It creates a new empty database, applies the scripts in order, and verifies object counts. It does not contain a password.

## Application connection

The ASP.NET Core API now uses the SQL-backed `WorkService` whenever `ConnectionStrings:ServiceDesk` is configured. `BaseDAL` opens each pooled connection and sets `SESSION_CONTEXT('BusinessId')` before feature SQL runs.

Run `work/configure-local-sql.ps1` to apply the repeatable development workspace seed, create/reset the restricted `servicedesk_runtime` login, add it to `servicedesk_app`, and store its generated connection string in ASP.NET Core user-secrets. The API does not run as `sa`, and no database password is stored in this repository.

The development seed provides the configured solo workspace, owner membership, active subscription, plan entitlements, and starter catalog. It is idempotent and is kept separate from production reference data in `06-development-data.sql`.

Real API verification created and read a customer, job, and job item through SQL Server. The verified job used number `J-0001` and returned a server-calculated total of `$125.00`.
