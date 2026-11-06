# FlowWork AI

**One Workspace. Every Workflow. Powered by AI.**

FlowWork AI is an agency work management product in development. The executable Phase 2 React frontend demonstrates project delivery, tasks, client collaboration, support conversations, analytics and the planned AI experience using fictional data.

**Current scope: Phase 2 frontend demo. Phase 1 documentation is preserved. The backend, real authentication, payments, email, uploads, live AI and real-time infrastructure are not implemented. Phase 3 has not started.**

## Run locally on Windows

Use Node.js 24 LTS (tested with 24.15.0), or a supported Node 22 release from 22.13.0. Dependencies live inside `frontend/`; there is no root install or backend package.

```powershell
Set-Location C:\FLOWWORKAI\frontend
npm.cmd install
npm.cmd run dev
```

Open the Local URL printed by Vite, normally `http://127.0.0.1:5173/`. Select **Explore Demo Workspace** to enter without signup. `npm.cmd` works when PowerShell execution policy blocks `npm.ps1`; ordinary `npm install` / `npm run dev` work in shells that allow it.

All projects, people and statistics are fictional. Domain changes stay in memory until refresh. Theme and sidebar preferences alone persist in localStorage. The client portal is a presentation preview and does not provide a secure session or authorization boundary.

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run test
npm.cmd run build
npm.cmd run test:e2e
```

Playwright uses installed Google Chrome by default. See the [frontend architecture guide](docs/phase-2-frontend-architecture.md) for the bundled Chromium alternative, test details, component/state explanations and future integration plan. No environment variable or secret is needed for this demo.

## Implemented frontend modules

Public landing/features/pricing; validated login/signup/recovery forms with honest unavailable-integration messages; onboarding and workspace switching; dashboard; project create/edit/list/detail; task create/edit/assign/filter and list/Kanban views; pointer dragging and keyboard-accessible status controls; task comments; clients and contacts; team profiles and pending demo invitations; support cases with public replies/internal notes; client-facing projects/milestones/feedback/support; notification read state; scripted FlowAI conversations; sample knowledge documents and local file metadata preview; Recharts analytics with date controls and local CSV export; workspace/account/appearance/notification settings; illustrative Starter/Growth/Business plans.

The Phase 2 brief expands the original UI foundation into a complete connected frontend preview. Future roadmap phases still own production business rules, persistence and integrations. Phase 1 documents describe the target system; the Phase 2 guide and final report describe what actually runs today.

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

Frontend dependencies are recorded in `frontend/package.json` and locked in `frontend/package-lock.json`. React Router handles navigation, Radix/shadcn components provide primitives, Tailwind 4 uses its Vite plugin, React Hook Form/Zod validate forms, and Recharts/dnd-kit/Sonner support charts, boards and feedback. Backend/provider choices remain planned. The dependency audit and compatibility decisions are recorded in the Phase 2 report.

## Architecture summary

The implemented frontend is organized into feature pages, shared components, typed fixtures and a replaceable in-memory repository. TanStack Query is configured for future remote state; local demo records use a subscribed repository, and Zustand owns UI preferences. No network service is impersonated.

The planned production system remains a modular monolith with domain-owned services and repositories. A React browser will communicate with one Express API/socket boundary; a worker from the same backend will process durable side effects and AI ingestion. MongoDB tenant records will require workspaceId and server-enforced membership/resource/client rules. Those security controls are documentation targets, not implemented frontend guarantees.

This trades physical tenant isolation and independent domain deployment for simpler transactions and lower early operational burden. Tests, explicit query scope and careful serializers are essential. No microservices or Kubernetes are planned for MVP.

## Roadmap and phase boundaries

| Phase | Scope | Status |
|---|---|---|
| 1 | Planning and Architecture | Documentation complete |
| 2 | Complete premium React frontend demo | Implemented; see Phase 2 report for verification |
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
- [Phase 2 · Frontend architecture](docs/phase-2-frontend-architecture.md): setup, folder structure, components, hooks, state, fixtures, routing, tests and integration boundaries.
- [Phase 2 · Verification and final report](docs/phase-2-final-report.md): exact file inventory, actual commands/results, acceptance criteria, limitations and Phase 3 prerequisites.
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
