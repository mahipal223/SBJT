# Tenant boundaries and ASP.NET Core implementation

## Request boundary

1. Validate the OIDC access token signature, issuer, audience and expiry. Resolve `auth.Users.Subject` from the verified token. MVP assumes one configured identity issuer; add an Issuer column/composite unique key before supporting multiple issuers.
2. Treat route `businessId` as untrusted requested scope. Using a narrowly scoped identity/provisioning service, verify the user has an Active membership and the business is accessible. Global user and membership enumeration endpoints return only the caller's memberships.
3. Construct immutable request-scoped `TenantContext(BusinessId, UserId, MemberId, Role, Permissions)` from server-side membership data. Validate every request; revocation must work before token expiry.
4. Open the SQL connection and set `SESSION_CONTEXT('BusinessId')` to the validated business before tenant queries. Explicitly initialize/reset it on every pooled checkout and clear in finally; do not rely solely on pool behavior. Never switch business mid-transaction. Disable MARS for this connection profile and test the exact SqlClient/SQL Server versions used.
5. Query through tenant-scoped EF Core filters and resource authorization. SQL row-level security is an additional boundary: matching context permits rows, missing/wrong context hides them and blocks wrong-tenant writes.
6. Apply role permission, assignment scope, business state, subscription feature and quota checks. Every write, download and background operation needs these checks.

`SESSION_CONTEXT` is set by the trusted middle tier, not by a database-authenticated browser user. This RLS policy prevents accidental cross-tenant access; it does not defend against a compromised API principal deliberately setting arbitrary business IDs. Parameterize all SQL, restrict database credentials, and never expose arbitrary SQL execution.

## SQL/EF configuration

```csharp
// Conceptual setup; integrate in the actual DbContext/interceptor implementation.
modelBuilder.Entity<Job>().HasKey(x => new { x.BusinessId, x.Id });
modelBuilder.Entity<Job>().HasQueryFilter(x => x.BusinessId == tenantContext.BusinessId);
modelBuilder.Entity<Job>().Property(x => x.Version).IsRowVersion();
```

For inserts, overwrite BusinessId from TenantContext rather than binding an entity directly to request JSON. Reject any submitted tenant/owner/status fields that are outside the DTO. Composite foreign keys enforce same-business references, and job location/asset keys also enforce the same customer.

Use a SQL parameter for `EXEC sys.sp_set_session_context @key=N'BusinessId', @value=@BusinessId`. Establish context before retrying any EF transaction on a new connection. The tenant ID must not be mutable once a unit of work starts. `IgnoreQueryFilters` is forbidden in business request handlers.

## Separate credentials and control plane

The included `servicedesk_app` role has business CRUD without DELETE, and no broad access to auth users or platform operations. It does not implement onboarding or admin bootstrap by itself.

- Identity service: only caller identity and membership lookup via signed/narrow stored procedures; no user-list API.
- Provisioning service: atomically create business, owner and trial. It is trusted to establish the newly generated business context.
- Business API: the supplied application role; no db_owner, ALTER SECURITY POLICY, ALTER schema, impersonation or backup privileges.
- Billing worker: only provider mapping, webhook inbox, subscriptions, plan changes and relevant outbox/audit access.
- Platform admin service: dedicated permission policies and aggregate/control-plane account summaries. It must not remove RLS or expose an all-tenants switch on business APIs.
- Backup operator: infrastructure principal, separate from application credentials.

Deploy-time principals and narrowly scoped bootstrap/admin procedures must be implemented for the chosen identity/hosting environment; never solve missing grants by assigning db_owner. No passwords or logins are embedded in this package.

Business root rows also have RLS. The `/admin/businesses` endpoint therefore needs a controlled account-summary projection maintained by the provisioning/status workflow, or a reviewed limited procedure. Do not implement it using unrestricted entity serialization or a user-controlled bypass flag. Support reads require an active platform Support role AND unexpired owner-approved grant for exactly one business. Support scope is read-only in MVP.

## Other boundaries

| Surface | Required behavior |
|---|---|
| Files | Private container; server-generated tenant/job keys; bounded upload reservation; virus scan before Ready; short-lived downloads issued after current authorization. |
| Search/reporting | Tenant ID in every query/index key. Technician work DTOs exclude financial fields. |
| Cache | Tenant ID + resource + permission scope in key. Invalidate membership caches upon deactivation/role change. |
| Background jobs | Explicit persisted business ID; re-establish validated service tenant context; exports recheck requester membership/role before generation and download. |
| Public estimate links | Scoped capability to one document revision; hashed token, expiration, one-time decision, no broad business API access. |
| Audit | Append-only event recording, no secrets/tokens/card data; tenant events remain in tenant scope, admin actions have separate platform audit. |
| Errors | Return 404 for inaccessible tenant-owned IDs. Map SQL constraint errors to generic business errors without leaking other tenants' values. |
| Export | Owner-only; private artifact; proposed 24-hour availability; recheck access before each download. |
| Backup | Infrastructure backup contains all intended data, not an RLS-filtered application export; encryption, access controls and restore drills. |

## Sources

- [SQL Server row-level security](https://learn.microsoft.com/en-us/sql/relational-databases/security/row-level-security)
- [SQL Server session context](https://learn.microsoft.com/en-us/sql/relational-databases/system-stored-procedures/sp-set-session-context-transact-sql)
- [ASP.NET Core policy authorization](https://learn.microsoft.com/en-us/aspnet/core/security/authorization/policies)
- [EF Core query filters](https://learn.microsoft.com/en-us/ef/core/querying/filters)
- [SQL Server rowversion](https://learn.microsoft.com/en-us/sql/t-sql/data-types/rowversion-transact-sql)
