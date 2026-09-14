# Backend API development instructions

The repository-wide implementation rules are maintained in [`AGENTS.md`](../AGENTS.md).

The standard requires:

- Thin ASP.NET Core controllers.
- Application command/query handlers for business rules.
- A shared `BaseDAL` for connections, tenant session context, typed parameters, transactions, and execution.
- One Application interface and one Infrastructure service for each business feature, following the `SieS.Api` reference structure.
- SQL row-level security plus API membership and permission checks.
- Server-side subscription, status, tax, and financial validation.
- Central ProblemDetails exception mapping, audit logs, concurrency control, and idempotency.
- SQL integration tests and Angular loading/error/empty/saving states.

Use this structure for new modules:

```text
Application/<Module>/
  Contracts/
  Commands/
  Queries/
  Validators/
Infrastructure/Services/
  <Module>Service.cs
Api/Controllers/
  <Module>Controller.cs
```

Keep each parameterized SQL statement beside the Infrastructure service method that executes and maps it. Do not create both `<Module>Queries.cs` and `<Module>Dal.cs`. Do not add feature SQL to `BaseDAL`, controllers, Angular, or one repository-wide query file.
