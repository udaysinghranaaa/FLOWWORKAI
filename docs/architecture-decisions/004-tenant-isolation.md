# ADR 004 · Shared collections with enforced workspace context

Status: accepted MVP design; isolation untested until implementation. Date: 2026-11-06.

## Context

Many small agency workspaces need economical shared persistence, while each agency's clients need additional isolation inside its own tenant. MongoDB references do not automatically enforce tenant boundaries.

## Decision

Store tenant data in shared collections with immutable workspaceId and tenant-leading query indexes. Require explicit authenticated TenantContext for every domain repository and service; enforce live membership, project grants, ownership and client publication server-side. Validate foreign IDs against workspace/parent. Use role-safe DTOs and conceal inaccessible objects. Isolate cache keys, object keys, event rooms, jobs and vector prefilters by tenant. Global identity/catalog/webhook intake paths are explicit restricted exceptions.

## Alternatives and trade-offs

Database-per-tenant simplifies some physical isolation and restoration tasks but complicates provisioning, indexes, operations and vector capacity for many small customers. Collection-per-tenant creates collection/index sprawl. A single tenant middleware filter alone is easy to bypass in aggregation, jobs and raw queries. Explicit repositories plus tests are chosen, while acknowledging application bugs can breach shared isolation.

## Consequences

Every new feature inherits a tenant test burden, including negative same-tenant client tests. Shared backup restore needs selective recovery procedures. Platform operators have no ordinary workspace bypass; break-glass is separately governed. Any dedicated enterprise database tier requires routing, migration, cost and restore design before being promised.

Validation: multi-tenant CRUD/aggregation/AI/file/socket/job suite, reference tampering, revision-aware cache switching, membership revocation. Related: [permissions](../02-roles-and-permissions.md), [security](../08-security-and-tenancy.md).
