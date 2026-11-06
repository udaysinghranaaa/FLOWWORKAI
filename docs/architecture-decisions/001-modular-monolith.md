# ADR 001 · Modular monolith over microservices

Status: accepted for Phase 1 blueprint; implementation pending. Date: 2026-11-06.

## Context

FlowWork AI is an unvalidated early SaaS with interdependent memberships, tasks, tickets and subscriptions. One team needs reliable transactions, debuggable behavior and affordable operations before independent service scaling becomes a proven need.

## Decision

Use Node.js/Express/TypeScript domain modules with explicit service interfaces and owned repositories. Deploy API/socket and worker processes from the same backend codebase; this separates workload scheduling without creating domain microservices. Frontend is a React/Vite application. MongoDB, Redis and private storage are infrastructure dependencies. No Kubernetes in MVP.

## Alternatives and trade-offs

Microservices offer independent deploy/scale boundaries but require distributed authorization, tracing, retries and consistency. A single undifferentiated Express application is simpler initially but obscures ownership and encourages unscoped model access. Serverless-per-endpoint complicates persistent sockets and transaction/workflow coordination. Modular code and one product deployment are the chosen middle ground.

## Consequences

Local domain transactions and one policy model reduce complexity. API and worker releases are coordinated; a shared backend can still have broad failure impact. Enforce imports/service boundaries, bounded jobs and module-owned schemas. Extract a service only with measured workload, independent ownership or compliance evidence, a stable interface and a migration plan. Revisit after production profiles justify independent scaling, not because module count grows.

Validation in future phases: module boundary review, transactional task/outbox test, worker/API resource isolation and staging outage drills. Related: [architecture](../03-system-architecture.md), [ADR 006](006-socket-events.md).
