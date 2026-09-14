# Phase 3 — services, materials, and job costing

This phase adds the price book and connects services, labor, materials, and parts to jobs.

## Delivered

- Tenant-scoped catalog list, search, type filtering, and item creation.
- Catalog item types: `Service`, `Labor`, and `Part`.
- Job line-item read and atomic replacement endpoints.
- Server-calculated subtotal, discount, tax, and job total.
- Catalog values are copied into job items so later catalog price changes do not alter historical work.
- Completed and cancelled jobs reject line-item changes.
- Catalog and job references from another workspace are rejected.
- Responsive Angular catalog management and job line-item controls.

## API routes

| Method | Route | Permission |
|---|---|---|
| GET | `/api/v1/businesses/{businessId}/catalog-items` | `catalog.read` |
| POST | `/api/v1/businesses/{businessId}/catalog-items` | `catalog.write` |
| GET | `/api/v1/businesses/{businessId}/jobs/{jobId}/items` | `jobs.read` |
| PUT | `/api/v1/businesses/{businessId}/jobs/{jobId}/items` | `jobs.write` |

## Calculation

Each line uses:

`round(quantity × unit price, 2) − discount + tax`

The API ignores browser-calculated totals and recomputes every amount. Quantity must be positive. Prices, discounts, costs, and tax cannot be negative. A discount cannot exceed the line's extended price.

## Next slice

Add job status transitions and completion rules, then generate a draft invoice from a completed job using immutable invoice snapshots.
