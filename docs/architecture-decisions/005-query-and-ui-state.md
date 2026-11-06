# ADR 005 · TanStack Query for server state; Zustand for UI state

Status: accepted frontend design; libraries not installed. Date: 2026-11-06.

## Context

The UI needs scoped remote data with retries/invalidation and small persistent presentation choices. Duplicating entities in multiple stores makes optimistic updates and tenant switching unsafe.

## Decision

TanStack Query owns all remote entities, fetch lifecycle and mutation invalidation. Keys include principal, workspace, resource/filter and authorization revision. Zustand owns sidebar, panel and command palette state only. React Hook Form owns editing state with Zod validation; URL owns shareable route filters. No auth tokens or sensitive query persistence in browser localStorage. Theme preference may be a non-sensitive local choice until an account preference schema is deliberately added.

## Alternatives and trade-offs

Redux with a server cache solution can work but adds conventions unnecessary for the initial scope. One Zustand store containing remote entities would require custom cache/retry/invalidation logic. React context alone is sufficient for some UI settings but less ergonomic for selective global transient updates. Query keys and optimistic rollback still require careful design even with TanStack Query.

## Consequences

No mirroring query data into Zustand. Abort/clear on principal or workspace change; revoke stale access by clearing revision-bound queries. 409 conflicts preserve unsaved form content for explicit refresh. Socket events invalidate/fetch state rather than become an independent entity database.

Validation: cross-workspace late-response race, logout cache removal, mutation rollback, duplicate hints and stale-version edits. Related: [architecture](../03-system-architecture.md), [UI system](../06-ui-ux-design-system.md).
