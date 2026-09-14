# Phase 1 foundation delivery

Completed September 9, 2026.

## Implemented

- Angular 22 application in `src/ServiceDesk.Web`
  - responsive ServiceDesk shell
  - login and tenant-aware overview
  - guarded routes
  - API proxy and development authentication interceptor
- ASP.NET Core 10 solution
  - `ServiceDesk.Domain`
  - `ServiceDesk.Application`
  - `ServiceDesk.Infrastructure`
  - `ServiceDesk.Api`
  - executable domain verification project
- API foundation
  - liveness and readiness endpoints
  - development-only authentication
  - active membership resolution
  - tenant context
  - permission authorization policies
  - generic 404 for unauthorized business scopes
  - Angular CORS policy
- Existing SQL Server schema, RLS, role and OpenAPI specification retained under `outputs/backend-spec`

## Verification

| Check | Result |
|---|---|
| .NET solution build | Passed, 0 warnings and 0 errors |
| Phase 1 domain checks | Passed |
| Angular production build | Passed, initial bundle 257.44 kB raw / 70.44 kB estimated transfer |
| Angular tests | 2 passed |
| API `/health/live` | 200 |
| Anonymous `/api/v1/me` | 401 |
| Development-authenticated `/api/v1/me` | 200 with Northstar membership |
| Authorized workspace request | 200 with Owner role and four permissions |
| Different business request | 404 with generic `resource_not_found` problem |

## Current boundary

The API currently resolves a fixed development membership from `appsettings.Development.json`. The development header is accepted only in the Development environment; protected production endpoints return 401 until an OIDC provider is configured.

The SQL Server connection string is configured, but database connectivity is not implemented or verified in the running API because NuGet/SQL Server authentication on this machine was unavailable. The SQL scripts themselves passed parser and structural validation earlier.

## Run

```powershell
$env:ASPNETCORE_ENVIRONMENT='Development'
dotnet run --project src/ServiceDesk.Api
```

```powershell
npm --prefix src/ServiceDesk.Web start
```

Open `http://localhost:4200` and select **Continue as demo owner**.

## Remaining Phase 1 completion work

1. Select and configure the production OIDC provider.
2. Create an authenticated SQL Server development database and execute schema scripts 01–04.
3. Add EF Core/SQL client dependencies once NuGet connectivity is available.
4. Replace the configuration membership resolver with SQL-backed membership lookup.
5. Set SQL `SESSION_CONTEXT` per pooled connection and run tenant-isolation integration tests with the restricted runtime principal.
6. Add a genuine SQL database readiness probe.
