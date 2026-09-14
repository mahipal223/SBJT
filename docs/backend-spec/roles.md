# Roles and permissions

A user is global; a role belongs to their membership in a particular business. The same user may own one business and work for another. Platform administrators do not inherit business access.

| Permission | Owner | Manager | Technician |
|---|---|---|---|
| workspace.read | Yes | Yes | Yes |
| workspace.manage | Yes | No | No |
| team.manage | Yes | No | No |
| subscription.manage | Yes | No | No |
| customers.read | Yes | Yes | No |
| customers.write | Yes | Yes | No |
| catalog.read | Yes | Yes | No |
| catalog.write | Yes | Yes | No |
| jobs.read | Yes | Yes | No |
| jobs.assigned.read | No | No | Yes |
| jobs.write | Yes | Yes | No |
| jobs.assign | Yes | Yes | No |
| jobs.work | Yes | Yes | Yes |
| estimates.manage | Yes | Yes | No |
| invoices.manage | Yes | Yes | No |
| payments.manage | Yes | Yes | No |
| reports.read | Yes | Yes | No |
| exports.manage | Yes | No | No |
| audit.read | Yes | No | No |
| support.approve | Yes | No | No |

Technician access is further restricted to currently assigned jobs and linked customer contact/location details. Technician DTOs exclude prices, costs, invoices and billing data. `jobs.work` permits notes, time, checklists and allowed work-status changes only; it does not permit reassignment or pricing changes.

Exports and audit history are owner-only in MVP. Managers get aggregate reports, not unrestricted exports. Ownership transfer is a dedicated atomic action, never a normal role edit. At least one active owner must remain.
