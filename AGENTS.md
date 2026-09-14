# ServiceDesk development instructions

These instructions apply to the entire repository. Follow them for every new API endpoint, database change, Angular integration, test, and refactor.

## Architecture

Keep the solution as a modular monolith with these responsibilities:

- `ServiceDesk.Api`: HTTP routing, authentication, authorization policies, request binding, response codes, and ProblemDetails mapping.
- `ServiceDesk.Application`: use cases, commands, queries, DTOs, validation, permissions, interfaces, and business rules.
- `ServiceDesk.Domain`: business entities, value objects, status definitions, and rules that do not depend on ASP.NET Core or SQL Server.
- `ServiceDesk.Infrastructure`: SQL Server access, external providers, files, email, clocks, and implementations of Application interfaces.
- `ServiceDesk.Web`: Angular presentation, forms, route guards, API services, and responsive UI.

Dependencies point inward. Domain must not reference Application, Infrastructure, API, or Angular. Application must not reference Infrastructure or API.

## Required API flow

Implement every business endpoint in this order:

1. Define or update the request/response contract.
2. Add the permission and subscription entitlement requirement.
3. Add an Application command/query handler that owns business rules.
4. Add the method to the feature service and execute its SQL through `BaseDAL`.
5. Keep each query beside the feature method that owns and maps it.
6. Keep the controller thin: bind, authorize, call the handler, and map the result.
7. Add meaningful tests for tenant isolation, permissions, validation, state changes, and concurrency when applicable.
8. Update OpenAPI and the endpoint index.

Do not place business rules or SQL in controllers.

## Data access standard

All SQL Server access must use one shared `BaseDAL`. Put it under:

`src/ServiceDesk.Infrastructure/Data/BaseDAL.cs`

`BaseDAL` owns only shared database mechanics:

- Open `SqlConnection` using the configured connection string.
- Set `SESSION_CONTEXT(N'BusinessId')` before any tenant query runs.
- Clear or overwrite tenant context whenever a pooled connection is acquired.
- Create commands with a timeout and `CancellationToken` support.
- Add explicitly typed `SqlParameter` values.
- Execute query, single-row query, scalar, and non-query commands.
- Execute a callback inside a SQL transaction with the requested isolation level.
- Convert SQL concurrency and constraint failures into infrastructure exceptions.
- Dispose connections, commands, readers, and transactions reliably.
- Record command duration and a safe query name. Never log SQL parameters containing personal or secret data.

`BaseDAL` must not contain customer, job, invoice, subscription, or other feature-specific SQL.

Do not use `AddWithValue`. Specify `SqlDbType`, size, precision, and scale so SQL Server receives stable parameter types and can reuse execution plans.

The API version of `ExecuteNonQueryAsync` returns the affected row count on success and throws `DataAccessException` on failure. Do not catch every exception and return `-1`: SQL Server can legitimately return `-1`, and a swallowed failure may let the API report success or continue an incomplete transaction. Central exception middleware maps the typed exception to a safe ProblemDetails response.

## Feature service structure

Follow the established `SieS.Api` structure: define an interface in Application and one implementation in Infrastructure. Keep parameterized SQL as a local raw string inside the service method that executes and maps it. Do not create both `<Feature>Queries` and `<Feature>Dal` classes.

```text
Infrastructure/
  Data/
    BaseDAL.cs
  Services/
    CustomerService.cs
    JobService.cs
    CatalogService.cs
    InvoiceService.cs
    SubscriptionService.cs
```

Format SQL as a multiline raw string close to its mapping code:

```csharp
public async Task<CustomerResponse?> GetAsync(
    Guid businessId,
    Guid customerId,
    CancellationToken cancellationToken)
{
    const string sql = """
        SELECT
            c.Id,
            c.Name,
            c.Email,
            c.Phone,
            c.Version
        FROM app.Customers AS c
        WHERE c.Id = @CustomerId
          AND c.ArchivedAt IS NULL;
        """;

    return await baseDAL.QuerySingleOrDefaultAsync(
        businessId,
        "Customers.Get",
        sql,
        MapCustomer,
        [SqlParameters.UniqueIdentifier("@CustomerId", customerId)],
        cancellationToken);
}
```

Never construct SQL from request text. Allow sorting only through a fixed server-side mapping. Use parameters for filters, values, identifiers, pagination, dates, and search patterns.

## Tenant boundary

- Authenticate the user before resolving a workspace.
- Resolve an active membership for the route `businessId`.
- Return the same generic `404 resource_not_found` for missing and foreign tenant resources.
- Take `BusinessId`, `UserId`, and `MemberId` from validated tenant context. Never bind them from a create/update request.
- Set SQL `SESSION_CONTEXT(N'BusinessId')` on every opened connection before tenant data access.
- Keep `BusinessId` in composite keys and foreign keys.
- Never disable row-level security in application code.
- Platform administration uses separate, explicitly authorized services and database permissions.

## Commands and transactions

- Application handlers own transaction boundaries and business invariants.
- Use one transaction for an aggregate change and its audit/outbox records.
- Use `Serializable`, `UPDLOCK/HOLDLOCK`, or `sp_getapplock` for seat limits, number sequences, quota reservations, payments, ownership changes, and downgrade checks.
- Recheck limits and permissions inside the transaction when concurrent requests could invalidate an earlier check.
- Never trust totals, tax, discounts, plan usage, roles, or status supplied by Angular. Recalculate and validate them on the server.
- Store catalog and customer snapshots in issued financial documents.
- Require rowversion/ETag checks for updates and state-changing commands.
- Use idempotency keys for invoice issue/send, payments, refunds, exports, invitations, and provider webhooks.

## Controllers and HTTP contracts

- Route prefix: `/api/v1/businesses/{businessId}` for tenant APIs.
- Use request DTOs; never expose SQL rows or domain entities directly.
- Use camelCase JSON, UTC RFC3339 timestamps, `YYYY-MM-DD` business-local dates, ISO currency codes, and decimal money values.
- Accept and propagate `CancellationToken`.
- Return `201 Created` with a location for new resources.
- Return `202 Accepted` with a status URL for queued work.
- Return `204 No Content` only when there is intentionally no response body.
- Paginate lists with a default size of 25 and maximum of 100.
- Validate text lengths, email, US phone/address fields, enum values, dates, quantities, and money ranges.
- Reject unknown or unsupported status transitions.
- Use the stable ProblemDetails codes documented in `outputs/backend-spec/api-conventions.md`.
- Never return SQL messages, stack traces, connection strings, tokens, hashes, or foreign tenant identifiers.

Controllers should normally contain no `try/catch`. Use centralized exception middleware to map known Application and Infrastructure exceptions to ProblemDetails.

## Permissions and subscriptions

- Apply a named permission policy to every endpoint.
- Check both role permission and current subscription state for writes.
- Read plan limits from `platform.PlanEntitlements` using `FeatureCode`, `Enabled`, and `LimitValue`.
- Never enforce a limit by parsing `DisplayText`.
- Count reserved usage where applicable: pending invitations for seats and pending uploads for storage.
- Lock and recheck quota usage before committing.
- Missing entitlements fail closed.

## Audit and security

- Write an append-only audit event for every create, update, archive, status transition, permission change, subscription change, export, and administrative action.
- Include tenant, actor membership, action, entity type/id, UTC timestamp, trace ID, and safe before/after metadata.
- Do not audit passwords, access tokens, full payment data, invitation tokens, or file contents.
- Store application database credentials outside source control using environment variables, a secret manager, or ASP.NET user-secrets for local development.
- The runtime API login must be restricted and must not use `sa` or `db_owner`.
- Parameterize every query and validate uploaded file type, size, and authorization.

## C# formatting and naming

- Use file-scoped namespaces and nullable reference types.
- Use one public type per file unless small request/response records are intentionally grouped by feature.
- Use PascalCase for types, methods, properties, and constants; camelCase for parameters and local variables; interfaces begin with `I`.
- Suffix transport models with `Request` and `Response`, application actions with `Command` or `Query`, handlers with `Handler`, and infrastructure feature implementations with `Service`.
- Prefer records for immutable DTOs and value objects.
- Prefer clear multiline code over compressed one-line statements.
- Use asynchronous database and HTTP APIs. Method names end in `Async`.
- Pass `CancellationToken` as the last parameter.
- Do not use magic strings for permissions, feature codes, roles, or statuses; define centralized constants or enums.
- Treat compiler and analyzer warnings as errors.

Run `dotnet format` after meaningful C# changes and do not leave formatting changes mixed with unrelated behavior when avoidable.

## Angular integration

- Keep API calls in feature services, not components.
- Use typed request and response interfaces generated from or aligned with OpenAPI.
- Components own presentation state; API/domain rules remain on the server.
- Every remote screen needs loading, empty, validation, error, retry, and success behavior.
- Disable duplicate submissions while a request is active.
- Display stable user-facing messages from ProblemDetails codes.
- Preserve accessible labels, keyboard behavior, focus states, and responsive layouts at 390px, 768px, 1024px, and desktop widths.

## Testing and completion

For each feature, test behavior that protects the business:

- Tenant A cannot list, read, update, delete, download, or reference Tenant B data.
- A missing tenant context returns no tenant rows.
- Roles without the required permission receive `403`.
- Invalid state transitions and stale rowversions fail.
- Concurrent quota, payment, invitation, and numbering requests cannot exceed limits or create duplicates.
- Server-calculated financial totals match stored line totals.
- Exact idempotent retries return the original result.

Use SQL integration tests for DAL queries and row-level security. Unit-test business rules in Application handlers. Avoid tests that only repeat the implementation.

Before marking work complete, run:

```powershell
dotnet format ServiceDesk.slnx --verify-no-changes
dotnet build ServiceDesk.slnx --no-restore
dotnet run --project tests/ServiceDesk.Api.Tests --no-build
npm --prefix src/ServiceDesk.Web run build
npm --prefix src/ServiceDesk.Web test -- --watch=false
```

Also verify affected API routes against SQL Server using the restricted runtime login and inspect desktop/mobile screens when UI behavior changed.

## Definition of done

An API feature is complete only when its contract, permission, entitlement check, Application rule, feature service, tenant-safe SQL behavior, audit event, tests, OpenAPI entry, Angular integration when applicable, and documentation agree.
