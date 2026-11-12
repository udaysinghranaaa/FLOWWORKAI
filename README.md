# FlowWork AI

**One Workspace. Every Workflow. Powered by AI.**

FlowWork AI is an agency work management product in development. The executable Phase 2 React frontend demonstrates project delivery, tasks, client collaboration, support conversations, analytics and the planned AI experience using fictional data.

**Current scope: Phase 6 real projects, tasks, persistent Kanban, project grants, assignments, subtasks, comments, activity, My Tasks and workspace metrics, alongside preserved Phases 1-5 and the separate public demo. See [Phase 6 report](docs/phase-6-final-report.md) for actual verification. Private credential rotation, Phase 5 live tenant readiness and separately approved Phase 6 schema rollout remain pending. Phase 7 has not started.**

## Run locally on Windows

Use a current patched Node.js 24 or 26 LTS release for the backend (tested on the installed Node 24.15.0 host). The frontend also supports its documented Node 22 range. Dependencies live independently inside `frontend/` and `backend/`; there is no root install.

```powershell
Set-Location C:\FLOWWORKAI\frontend
npm.cmd install
npm.cmd run dev
```

Open the Local URL printed by Vite, normally `http://127.0.0.1:5173/`. Select **Explore Demo Workspace** to enter without signup. `npm.cmd` works when PowerShell execution policy blocks `npm.ps1`; ordinary `npm install` / `npm run dev` work in shells that allow it.

All demo projects, people and statistics are fictional. Demo domain changes stay in memory until refresh; real identities persist through the separate MongoDB auth APIs. Theme and sidebar preferences alone persist in localStorage. The demo client portal remains a presentation preview and does not provide a production authorization boundary.

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run test
npm.cmd run build
npm.cmd run test:e2e
```

Playwright uses installed Google Chrome by default. See the [frontend architecture guide](docs/phase-2-frontend-architecture.md) for the bundled Chromium alternative and original demo design. The full browser suite now also builds the backend and starts isolated local MongoDB auth fixtures; install backend dependencies first. It never uses the owner's Atlas URI. No backend secret is needed to explore the public demo.

## Backend foundation and real identity

Run in a second terminal, independently of the frontend:

```powershell
Set-Location C:\FLOWWORKAI\backend
npm.cmd install
npm.cmd run build
npm.cmd run db:check
# After private credential rotation and a successful read-only check:
npm.cmd run schema:tenants -- --rotation-confirmed
npm.cmd run dev
```

Default listener: `http://127.0.0.1:5000`. Preserve the existing `backend/.env`; never overwrite/copy an example over it. The existing infrastructure settings plus MONGODB_URI/JWT_SECRET are validated. Node's native env loader gives process variables precedence. Local CORS defaults allow exactly `http://localhost:5173` and `http://127.0.0.1:5173`; keep browser/API host spelling aligned. Mail links use the first configured FRONTEND_ORIGIN. Configure an exact origin if Vite chooses another port. The read-only database check prints only booleans/static diagnostics; DATABASE_URI_INVALID requires a private formatting/options correction. No Atlas user/network settings or existing credentials were changed.

| Method | Endpoint | Behavior |
|---|---|---|
| GET | /api/v1/health | Safe HTTP readiness summary |
| GET | /api/v1/health/live | Process liveness |
| GET | /api/v1/health/ready | Lifecycle readiness, 503 when unavailable |
| GET | /api/v1/example?limit=2 | Development-only deterministic catalog |
| GET | /api/v1/example/:code | Development-only enum parameter example |
| POST | /api/v1/example/validate | Development-only body validation/computation |
| GET | /api/v1/auth/csrf | Signed pre-session/session CSRF bootstrap |
| POST | /api/v1/auth/register | Generic registration result; pending verification |
| POST | /api/v1/auth/login | Password/verification check and HttpOnly credentials |
| POST | /api/v1/auth/refresh | Atomic opaque refresh rotation |
| POST | /api/v1/auth/logout | Idempotent current-session revocation |
| POST | /api/v1/auth/logout-all | Revoke all sessions and authentication epoch |
| GET | /api/v1/auth/me | Current safe database-verified identity |
| POST | /api/v1/auth/forgot-password | Generic recovery instruction request |
| POST | /api/v1/auth/reset-password | One-time reset and all-session revocation |
| POST | /api/v1/auth/verify-email | One-time email confirmation |
| POST | /api/v1/auth/resend-verification | Generic throttled replacement request |

```powershell
Invoke-RestMethod http://localhost:5000/api/v1/health
$body = @{ label = 'Useful example'; count = 2 } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri http://localhost:5000/api/v1/example/validate `
  -ContentType 'application/json' -Body $body
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run test
npm.cmd run build
npm.cmd run format:check
```

Also available: `test:watch`, `format` and the read-only `db:check` after build. Production `npm.cmd start` runs compiled code and forces production mode; it requires valid database/signing settings, explicit HTTPS frontend origins and TLS SMTP configuration. Development capture is forbidden in production, and example routes return 404. See the [current auth architecture guide](docs/phase-4-database-auth-architecture.md) for setup, cookie/CSRF flow and test safety.

The app preserves the Phase 1 `{data,meta:{requestId}}` / `{error,meta:{requestId}}` contract, with 422 schema errors and 400 malformed JSON. Existing Zod/Helmet/Pino/request-ID/body-cap/rate/error/shutdown infrastructure remains. Real auth adds Mongoose, Argon2id, minimal short-lived JWT access cookies, hashed rotating refresh families, immediate database-backed revocation, CSRF and credentialed exact-origin CORS. Proxy trust remains disabled and limits remain process-local. [OpenAPI](backend/openapi.json) covers only implemented operations.

Sign up in the React form, open the verification link from ignored `backend/.mail-capture/` privately, confirm it, then sign in to `/account`. Capture sends no real email; production requires SMTP. The authenticated account now links to real company onboarding and authorized workspaces. Demo workspace identities/records remain fictional and never authorize backend requests or become customer data. Browser credentials are HttpOnly cookies, never localStorage. VITE_API_BASE_URL is public connection configuration only; production defaults to the same-origin `/api/v1`. Real company/workspace administration and invitations are implemented in Phase 5; queues, live AI, payments and real-time integration remain deferred.

## Implemented frontend modules

Public landing/features/pricing; real login/signup/recovery/verification and guarded account identity; clearly labeled demo onboarding/workspace switching; dashboard; project create/edit/list/detail; task create/edit/assign/filter and list/Kanban views; pointer dragging and keyboard-accessible status controls; task comments; clients and contacts; team profiles and pending demo invitations; support cases with public replies/internal notes; client-facing projects/milestones/feedback/support; notification read state; scripted FlowAI conversations; sample knowledge documents and local file metadata preview; Recharts analytics with date controls and local CSV export; demo workspace/account/appearance/notification settings; illustrative Starter/Growth/Business plans.

The Phase 2 brief expanded the UI foundation into a complete connected frontend preview. Future roadmap phases still own production business rules and domain persistence/integrations. Phase 1/2 guides retain that history; the Phase 4 guides describe preserved identity behavior, while the Phase 5 guides describe current tenancy and live rollout gates.

## Problem and customer hypothesis

Small agencies often coordinate projects, client requests, documents and status reports across separate tools. FlowWork AI proposes a workspace with clear internal/client boundaries and an advisory assistant grounded in authorized sources. Target hypothesis: 5–50 internal staff serving multiple clients. Market demand, pricing and customer savings still require discovery; no existing customers or measured product outcomes are claimed.

## Product modules and remaining scope

Real identity/sessions and company/workspace membership administration are implemented locally through Phase 5; live rollout awaits credential rotation and schema initialization. Phase 6 adds locally verified projects/grants, tasks/Kanban and comments. Remaining production modules: clients/contacts; files; milestones/client portal; support tickets; durable notifications/real-time hints; knowledge/RAG/FlowAI; scoped analytics; subscription entitlements/hosted billing. Their current frontend demonstrations are not database-backed business APIs.

Launch AI is internal and read-only. Teams initially mean workspace/project membership. CRM automation, payroll, full accounting, live document editing, SSO and autonomous AI actions are outside the launch scope.

## Planned stack

| Layer | Technology |
|---|---|
| Frontend | React, Vite, TypeScript, Tailwind CSS, shadcn/ui, Radix UI, Lucide, React Router |
| State/forms | TanStack Query for server state, Zustand for UI state, React Hook Form + Zod |
| Backend | Node.js, Express, TypeScript, REST, Zod, structured logs and centralized errors |
| Persistence | MongoDB Atlas, Mongoose, compound indexes, transactions and tenant-scoped repositories |
| Authentication | Secure HttpOnly cookies, short-lived JWT access with database session checks, rotating opaque refresh families, Argon2id; current database organization/workspace RBAC |
| Real-time/jobs | Socket.IO, durable MongoDB outbox, worker from same backend codebase; proposed Redis for queue/adapter/limits |
| AI | Server-side provider adapter, embeddings, MongoDB Vector Search, tenant-safe RAG, validation and quotas |
| Files | Private S3-compatible storage, clean-only access and malware scanning |
| Verification/operations | Vitest, Supertest, Playwright; Docker/Compose; GitHub Actions; validated environment configuration |

Frontend dependencies are recorded in `frontend/package.json` and locked in `frontend/package-lock.json`. React Router handles navigation, Radix/shadcn components provide primitives, Tailwind 4 uses its Vite plugin, React Hook Form/Zod validate forms, and Recharts/dnd-kit/Sonner support charts, boards and feedback. Backend HTTP, database, auth and mail-adapter dependencies are independently locked in `backend/package-lock.json`; business/AI/billing/storage integrations remain future work. Audit and compatibility decisions appear in the corresponding phase reports.

## Architecture summary

The implemented frontend is organized into feature pages, shared components, typed fixtures and a replaceable in-memory repository. TanStack Query serves real identity and tenant APIs; local demo records use a subscribed repository, and Zustand owns UI preferences. No network service is impersonated.

The implemented backend exports an isolated application factory and a separate compiled listener entrypoint. Global HTTP policy precedes the versioned registry; routes validate input, controllers map transport, auth and tenant services perform guarded MongoDB transactions, and one error handler normalizes failures. React identity flows call real auth APIs, while demo business pages still use the unchanged in-memory repository. Required database readiness gates real startup/traffic; cleanup hooks close actual connections and drain pending mail.

The planned production system remains a modular monolith with domain-owned services and repositories. A React browser will communicate with one Express API/socket boundary; a worker from the same backend will process durable side effects and AI ingestion. Implemented tenant records use organizationId/workspaceId with current database membership checks. Future client/project rules, worker/outbox and sockets remain plans, not frontend guarantees.

This trades physical tenant isolation and independent domain deployment for simpler transactions and lower early operational burden. Tests, explicit query scope and careful serializers are essential. No microservices or Kubernetes are planned for MVP.

## Roadmap and phase boundaries

| Phase | Scope | Status |
|---|---|---|
| 1 | Planning and Architecture | Documentation complete |
| 2 | Complete premium React frontend demo | Implemented; see Phase 2 report for verification |
| 3 | Express Backend Foundation | Implemented; see Phase 3 report for verification |
| 4 | MongoDB and Authentication | Preserved; current live rollout gates are in the Phase 5 report |
| 5 | Companies, Workspaces, Teams and Multi-Tenancy | Implemented and isolated-tested; live schema/acceptance pending rotation |
| 6 | Projects and Task Management | Implemented locally; see Phase 6 report for checks and live blockers |
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
- [Phase 3 · Backend architecture](docs/phase-3-backend-architecture.md): independent setup, lifecycle, middleware, validation, errors, security, logging and extension points.
- [Phase 3 · Interview notes](docs/phase-3-interview-notes.md): 20 concepts, small examples and a request walkthrough.
- [Phase 3 · Verification and final report](docs/phase-3-final-report.md): exact changes, executed checks, acceptance criteria, limits and Phase 4 prerequisites.
- [Phase 4 · Database and auth architecture](docs/phase-4-database-auth-architecture.md): models/indexes, transactions, cookies/CSRF, mail, frontend lifecycle and safe tests.
- [Phase 4 · Interview notes](docs/phase-4-interview-notes.md): 25 concepts with what/why/how/code/interview explanations.
- [Phase 4 · Final report](docs/phase-4-final-report.md): exact changes, actual checks, local/live verification distinction and acceptance blockers.
- [ADR 001 · Modular monolith](docs/architecture-decisions/001-modular-monolith.md)
- [ADR 002 · MongoDB](docs/architecture-decisions/002-mongodb.md)
- [ADR 003 · Session authentication](docs/architecture-decisions/003-session-authentication.md)
- [ADR 004 · Tenant isolation](docs/architecture-decisions/004-tenant-isolation.md)
- [ADR 005 · Server/UI state](docs/architecture-decisions/005-query-and-ui-state.md)
- [ADR 006 · Socket events](docs/architecture-decisions/006-socket-events.md)
- [ADR 007 · LLM adapter](docs/architecture-decisions/007-llm-provider-adapter.md)
- [ADR 008 · Vector Search and RAG](docs/architecture-decisions/008-vector-search-rag.md)
- [ADR 009 · JWT cookie authentication](docs/architecture-decisions/009-jwt-cookie-authentication.md)
- [Engineering rules](AGENTS.md)

## Working on this repository

Read AGENTS.md and the relevant design documents first. Implement only the explicitly requested phase, preserve existing functionality and report actual verification. This documentation is an implementation plan; it does not demonstrate production performance, security compliance or commercial viability. Destructive/sensitive operations require appropriate authorization. Stop at the authorized phase boundary.

## Phase 5 real company workspace

Read [tenant architecture](docs/phase-5-multi-tenant-architecture.md), [interview notes](docs/phase-5-interview-notes.md) and [verification report](docs/phase-5-final-report.md). Real onboarding is `/app/onboarding`; authorized workspaces are `/app/workspaces`. Public `/onboarding` and `/w/studio` remain demos. After private credential rotation, run `npm.cmd run build`, `npm.cmd run db:check`, then explicitly `npm.cmd run schema:tenants -- --rotation-confirmed` in backend before starting the real server. This adds schema only; never seed or clean Atlas with test fixtures. The agent has not performed live schema installation. Run commands separately in frontend/backend; there is no root package.

## Phase 6 real projects and tasks

Open an authorized workspace and choose Projects, Tasks or My Tasks. Projects have scoped grants, tasks have real assignment, comments/subtasks/history, and the board persists moves and ordering. Overview counts come from scoped database aggregation. Public demo pages stay separate. Read [the architecture](docs/phase-6-architecture.md), [API inventory](docs/phase-6-api-inventory.md) and [final report](docs/phase-6-final-report.md). In backend, `npm.cmd run schema:work` prints a read-only plan. Applying schema requires private rotation, Phase 5 readiness and separate intended-environment approval; the agent has not run apply.
