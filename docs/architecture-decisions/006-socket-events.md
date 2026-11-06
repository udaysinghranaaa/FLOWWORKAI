# ADR 006 · Socket.IO hints backed by durable state

Status: accepted design; adapter/library versions selected in Phase 3/9. Date: 2026-11-06.

## Context

Users need timely collaboration, but temporary disconnects, worker retries and access revocation make a live connection insufficient as a source of truth. Socket.IO does not promise durable exactly-once business delivery.

## Decision

Use REST for mutations and Socket.IO for small authorized invalidation/notification hints. Persist domain mutation and outbox event atomically; worker upserts durable recipient notifications, rechecks current access and publishes event IDs/resource versions. Clients deduplicate and reconcile HTTP state on reconnect. Rooms derive from authenticated workspace/project/user grants, never payload room names. Use supporting Redis for job dispatch, distributed limits and compatible multi-instance Socket.IO adapter; choose a maintained job library in Phase 3 rather than inventing a bespoke Redis queue.

## Alternatives and trade-offs

Polling alone is simpler and remains a safe fallback but increases idle requests and update delay. SSE works for one-way hints, but Socket.IO supports planned presence and reconnection conventions across transports. Full event sourcing or a separate broker/service fleet is disproportionate to MVP needs. REST plus outbox is more work than fire-and-forget emits but survives crash windows.

## Consequences

Additional Redis operations, worker retry/lease logic and outbox retention are required. At-least-once jobs need idempotent consumers. Adapter recovery support varies, so always reauthorize/refetch; do not assume reconnection restores every event. Polling transport needs sticky routing with multiple API instances. Redis outage delays hints, not committed task truth; high-risk shared-limit failures fail closed.

Validation: disconnect gaps, duplicate/out-of-order events, worker crash after commit, unauthorized room requests, membership revocation and multi-replica staging. Related: [official delivery guarantees](https://socket.io/docs/v4/delivery-guarantees/), [architecture](../03-system-architecture.md).
