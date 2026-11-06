# FlowWork AI

**One Workspace. Every Workflow. Powered by AI.**

FlowWork AI is a planned multi-tenant SaaS workspace for software development and digital marketing agencies. It brings delivery tasks, client-visible milestones, support conversations and permission-aware knowledge assistance into a shared workflow.

**Current status: Phase 1 planning and documentation complete. No application code, working product, installed dependencies, deployed infrastructure or validated customer results exist. Phase 2 has not started and requires explicit instruction.**

## Problem and customer hypothesis

Small agencies often coordinate projects, client requests, documents and status reports across separate tools. FlowWork AI proposes a workspace with clear internal/client boundaries and an advisory assistant grounded in authorized sources. Target hypothesis: 5–50 internal staff serving multiple clients. Market demand, pricing and customer savings still require discovery; no existing customers or measured product outcomes are claimed.

## Planned modules

Identity and sessions; workspaces and memberships; clients/contacts; projects and grants; tasks/Kanban; comments/files; milestones and client portal; support tickets; durable notifications and real-time hints; knowledge/RAG and FlowAI; scoped analytics; subscription entitlements and hosted billing.

Launch AI is internal and read-only. Teams initially mean workspace/project membership. CRM automation, payroll, full accounting, live document editing, SSO and autonomous AI actions are outside the launch scope.

## Planned stack

| Layer | Technology |
|---|---|
| Frontend | React, Vite, TypeScript, Tailwind CSS, shadcn/ui, Radix UI, Lucide, React Router |
| State/forms | TanStack Query for server state, Zustand for UI state, React Hook Form + Zod |
| Backend | Node.js, Express, TypeScript, REST, Zod, structured logs and centralized errors |
| Persistence | MongoDB Atlas, Mongoose, compound indexes, transactions and tenant-scoped repositories |
| Authentication | Secure HttpOnly cookies, opaque short-lived access and rotating refresh families, Argon2id, server authorization |
| Real-time/jobs | Socket.IO, durable MongoDB outbox, worker from same backend codebase; proposed Redis for queue/adapter/limits |
| AI | Server-side provider adapter, embeddings, MongoDB Vector Search, tenant-safe RAG, validation and quotas |
| Files | Private S3-compatible storage, clean-only access and malware scanning |
| Verification/operations | Vitest, Supertest, Playwright; Docker/Compose; GitHub Actions; validated environment configuration |

Runtime/library versions and provider-specific choices will be verified and pinned when implementation is authorized. There is intentionally no install/run command or package manifest yet.

## Architecture summary

Use a modular monolith with domain-owned services and repositories. A React browser communicates with one Express API/socket boundary; a worker from the same backend processes durable side effects and AI ingestion. Shared MongoDB tenant collections require workspaceId; current membership, project grants, client association and publication narrow every action. Global identity, session and plan data have explicit separate access paths. Socket hints reconcile through durable HTTP state. AI retrieval prefilters authorized source IDs and rechecks live ACLs before exposing content.

This trades physical tenant isolation and independent domain deployment for simpler transactions and lower early operational burden. Tests, explicit query scope and careful serializers are essential. No microservices or Kubernetes are planned for MVP.

## Roadmap and phase boundaries

| Phase | Scope | Status |
|---|---|---|
| 1 | Planning and Architecture | Documentation complete |
| 2 | Premium React UI Foundation | Planned; requires instruction |
| 3 | Express Backend Foundation | Planned |
| 4 | MongoDB and Authentication | Planned |
| 5 | Workspaces, Teams and Multi-Tenancy | Planned |
| 6 | Projects and Task Management | Planned |
| 7 | Client Portal | Planned |
| 8 | Support Ticket Management | Planned |
| 9 | Real-Time Collaboration | Planned |
| 10 | AI Assistant and RAG | Planned |
| 11 | Analytics and SaaS Billing | Planned |
| 12 | Security, Testing and Deployment | Planned |
| 13 | Documentation and Interview Preparation | Planned |

The launch MVP is the minimum scope after integrated gates through Phase 12, not a feature set already delivered in Phase 1. See the roadmap for objectives, files, tests and completion criteria per phase.

## Documentation index

- [01 · Product requirements](docs/01-product-requirements.md): customers, modules, journeys, acceptance criteria, performance targets and assumptions.
- [02 · Roles and permissions](docs/02-roles-and-permissions.md): canonical permission matrix, project/client policy, ownership and revocation.
- [03 · System architecture](docs/03-system-architecture.md): stack, module structure, six system/sequence diagrams, lifecycle and failures.
- [04 · Database design](docs/04-database-design.md): 24 core collections, five operational collections, validation/indexes/lifecycle and ER diagram.
- [05 · API design](docs/05-api-design.md): endpoint contracts, envelopes, pagination, validation, status codes and idempotency.
- [06 · UI/UX design system](docs/06-ui-ux-design-system.md): themes, tokens, components, responsive rules and accessibility.
- [07 · Screen specifications](docs/07-screen-specifications.md): 26 pages, navigation, data, interactions and states.
- [08 · Security and tenancy](docs/08-security-and-tenancy.md): threat model, auth, files, RAG, retention and release tests.
- [09 · Development roadmap](docs/09-development-roadmap.md): all 13 phase gates.
- [10 · Phase 1 verification and final report](docs/10-phase-1-verification.md): actual review results, exact files, risks and interview concepts.
- [ADR 001 · Modular monolith](docs/architecture-decisions/001-modular-monolith.md)
- [ADR 002 · MongoDB](docs/architecture-decisions/002-mongodb.md)
- [ADR 003 · Session authentication](docs/architecture-decisions/003-session-authentication.md)
- [ADR 004 · Tenant isolation](docs/architecture-decisions/004-tenant-isolation.md)
- [ADR 005 · Server/UI state](docs/architecture-decisions/005-query-and-ui-state.md)
- [ADR 006 · Socket events](docs/architecture-decisions/006-socket-events.md)
- [ADR 007 · LLM adapter](docs/architecture-decisions/007-llm-provider-adapter.md)
- [ADR 008 · Vector Search and RAG](docs/architecture-decisions/008-vector-search-rag.md)
- [Engineering rules](AGENTS.md)

## Working on this repository

Read AGENTS.md and the relevant design documents first. Implement only the explicitly requested phase, preserve existing functionality and report actual verification. This documentation is an implementation plan; it does not demonstrate production performance, security compliance or commercial viability. Destructive/sensitive operations require appropriate authorization. Stop at the authorized phase boundary.
