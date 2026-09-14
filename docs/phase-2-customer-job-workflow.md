# Phase 2 — customer and job workflow

Phase 2 turns the approved customer and job screens into a working vertical slice.

## Delivered

- Customer list/search, create, and detail screens call ASP.NET Core APIs.
- Job list/filter, create, and detail screens call ASP.NET Core APIs.
- Every endpoint requires an active membership and its specific read/write permission.
- `BusinessId` comes from the tenant route/context and is never accepted in a create payload.
- Job creation rejects a customer outside the current business.
- Job creation reads the current subscription's billing-period limit and returns `409 plan_limit_reached` when full.
- Solo owners can leave a job unassigned; scheduled dates change the initial state from `Draft` to `Scheduled`.

## API routes

| Method | Route | Permission |
|---|---|---|
| GET | `/api/v1/businesses/{businessId}/customers` | `customers.read` |
| POST | `/api/v1/businesses/{businessId}/customers` | `customers.write` |
| GET | `/api/v1/businesses/{businessId}/customers/{customerId}` | `customers.read` |
| GET | `/api/v1/businesses/{businessId}/jobs` | `jobs.read` |
| POST | `/api/v1/businesses/{businessId}/jobs` | `jobs.write` |
| GET | `/api/v1/businesses/{businessId}/jobs/{jobId}` | `jobs.read` |

## Persistence boundary

`IWorkStore` keeps the application/API contract independent from storage. The configured API resolves it to SQL-backed `WorkService`, which routes all SQL mechanics through `BaseDAL`. The in-memory implementation remains available only when no connection string is configured.

## Next slice

Create estimates from job items, then convert approved work into invoices with immutable customer and line-item snapshots.
