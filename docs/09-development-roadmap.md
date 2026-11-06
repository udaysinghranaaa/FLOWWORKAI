# 09 · Development roadmap

**Current state: Phase 1 documentation complete. Phases 2–13 are planned and unimplemented.** Completion of this document is not approval to implement another phase. Each phase requires user instruction; changes to scope/stack update related documents and ADRs.

Testing requirements below describe future gates, not tests already executed. File locations refer to the proposed structure in document 03; none of those application directories exist yet. Integration fixtures must model multiple tenants from the first persistence phase onward. Security is built into each phase; Phase 12 verifies accumulated controls rather than introducing tenant security at the end.

## Phase 1 · Planning and Architecture — documentation complete

- Objectives: make product, security, data, API and UI boundaries reviewable before coding.
- Prerequisites: original brief and repository inspection; workspace was empty and had no Git metadata.
- Features/scope: requirements, role matrix, modular architecture, collection contracts, routes, all 26 screen plans, security and roadmap, eight ADRs and engineering rules.
- Files: README.md, AGENTS.md, docs/01–09, docs/architecture-decisions/*, docs/10-phase-1-verification.md.
- Concepts: domain boundaries, tenancy, RBAC plus resource policy, transactional invariants, RAG, product assumptions.
- Deliverables: linked documentation set and exact file/report inventory.
- Verification: internal links, required coverage, diagram static sanity, consistent enums/permissions, no application code/dependencies; actual results in document 10.
- Completion criteria: whole requested scope documented and reviewed, limitations disclosed. No production performance or security claim.
- Risks/dependencies: discovery, provider/cost/legal decisions remain proposed; explicit instruction required for Phase 2.

## Phase 2 · Premium React UI Foundation — planned

- Objectives: establish accessible visual primitives and navigation with clearly labeled fixture data.
- Prerequisites: approved design/route scope; instruction to start Phase 2; confirm package/runtime versions then.
- Features: Vite React TypeScript shell, Tailwind semantic themes, shadcn/Radix/Lucide, React Router public/internal/client shells, TanStack Query provider, Zustand UI-only store, form conventions. Static page foundations follow document 07; no claim of backend auth.
- Files/modules: apps/web/src/app, routes, components, styles, features/* presentation; web package/build config.
- Concepts: component composition, accessibility, remote versus UI state, route nesting, responsive design.
- Deliverables: reusable primitives, shell navigation, representative dashboard/task/portal layouts using fixtures, visual catalog.
- Tests: Vitest for meaningful stateful interactions; Playwright keyboard navigation/theme/mobile critical journeys, contrast measurements and manual screen-reader check.
- Completion criteria: no misleading live-data/auth claims, responsive agreed screens, typed build and accessible core flow; all fixture adapters replaceable.
- Risks: visual drift, excess dependencies, false expectation that client route guards supply security.

## Phase 3 · Express Backend Foundation — planned

- Objectives: create modular Node/Express TypeScript service foundation without implementing all business domains.
- Prerequisites: authorized phase, API conventions and infrastructure decisions reviewed.
- Features: config validation, route/controller/service boundaries, Zod transport validation, JSON error envelopes, request IDs, structured redacted logging, health/readiness, graceful shutdown; select Redis job library and adapter strategy with rationale.
- Files/modules: apps/api/src/bootstrap, config, http, shared, module skeletons; packages/contracts; package scripts.
- Concepts: middleware order, dependency boundaries, error taxonomy, process health, backpressure.
- Deliverables: backend skeleton, bounded parsers, Docker development draft, test harness; no fake DB readiness.
- Tests: Supertest validation/error/redaction/CSRF bootstrap contracts where applicable, malformed bodies and startup config failure.
- Completion criteria: reproducible start/build/typecheck, no secrets exposed, dependency failure readiness semantics documented.
- Risks: overbuilding abstractions; background infrastructure must be justified and configured, not silently assumed.

## Phase 4 · MongoDB and Authentication — planned

- Objectives: establish persistence, secure identity and revocable session families.
- Prerequisites: replica-set test setup, Atlas non-production project, email provider choice and approved session policy.
- Features: Mongoose schemas/index migrations for users/sessions/action tokens, verification/reset, Argon2id, CSRF/cookies, login/refresh/logout, own profile/sessions, recent reauth.
- Files/modules: modules/auth, users; shared/persistence; transport auth schemas; frontend auth forms; index migration scripts.
- Concepts: hashing versus encryption, credential rotation, compare-and-swap, replay detection, TTL limitations, enumeration defenses.
- Deliverables: real auth journey, session management, reset delivery in test environment, secret/runbook setup.
- Tests: Vitest hashing/expiry decisions, Supertest replay/single-use/rate limits, concurrent tab refresh behavior, Playwright actual cookie/CSRF/origin tests.
- Completion criteria: revoke/reset invalidates old credentials, no token in storage/logs, duplicate-email behavior safe, meaningful negative tests pass.
- Risks: cookie topology, delivery reliability, refresh races, hashing resource exhaustion; benchmark parameters before external traffic.

## Phase 5 · Workspaces, Teams and Multi-Tenancy — planned

- Objectives: make tenant policy unavoidable before adding delivery data.
- Prerequisites: Phase 4 secure auth, reviewed role matrix and transaction tests.
- Features: workspace creation/switching, owner guard, memberships/invitations, clients/contacts, authorization context, admin screens, audit foundation. Teams are workspace/project membership, not a separate organization subsystem.
- Files/modules: workspaces, members, clients, audit, shared/policy; web workspace/team/client features; supporting outbox/idempotency collections.
- Concepts: RBAC/resource intersection, tenant-scoped repositories, foreign reference integrity, owner concurrency, invitation state machines.
- Deliverables: isolated workspaces, real role-aware UI, removal/revision handling, reusable multi-tenant test fixtures.
- Tests: two tenants/two clients, role hierarchy, invite email mismatch/expiry, last-owner concurrency, mass assignment, switch cache clearing.
- Completion criteria: all repositories require scope, no cross-tenant read/write, current membership drives every action, no ownerless workspace.
- Risks: Admin/Owner ambiguity, access leaked by aggregations or UI query keys, dormant grants accidentally restored.

## Phase 6 · Projects and Task Management — planned

- Objectives: deliver the core agency work loop.
- Prerequisites: active tenant policy, storage/scanner choice, durable outbox pattern.
- Features: projects/grants, tasks/Kanban, comments, milestones, private attachments, publicSummary and explicit publication, activity; APIs and views from documents 04–07.
- Files/modules: projects, tasks, milestones, attachments; web project/board/task features; worker scan and outbox jobs.
- Concepts: optimistic concurrency, rank ordering, referential validation, direct upload trust, transaction side effects.
- Deliverables: create/assign/move/comment/upload flow, policy-safe task DTOs, clean-only downloads.
- Tests: task edit/assignment matrix, stale moves, idempotent creates, project/client relation, MIME/size tampering, scan failure and orphan cleanup.
- Completion criteria: full staff journey works with actual data, failures preserve drafts, public content review explicit, files are private and scanned.
- Risks: drag accessibility, rank contention, stale signed URLs and accidental publication.

## Phase 7 · Client Portal — planned

- Objectives: expose only intentionally shared delivery information.
- Prerequisites: project grants, client contacts, publication rules and DTO isolation from Phase 6.
- Features: client shell, published project/task/milestone views, public comments, clean authorized files, portal dashboard; tickets link awaits Phase 8.
- Files/modules: client-safe serializers/policies in existing domains; web portal routes/components.
- Concepts: same-tenant customer isolation, field-level privacy, ancestor visibility, safe empty/404 states.
- Deliverables: real client journey independent of internal UI assumptions.
- Tests: two clients within same workspace, internal field exclusion at HTTP/socket payload level, unpublished parent blocks child, removed contact/grant denies files.
- Completion criteria: client cannot browse staff directory/AI/billing/internal notes; each route enforces public projection server-side.
- Risks: sharing titles inadvertently, aggregations revealing internal counts, stale notifications leaking summaries.

## Phase 8 · Support Ticket Management — planned

- Objectives: create auditable client support conversations.
- Prerequisites: client portal and role-safe files/outbox ready.
- Features: ticket numbers/counters, staff inbox, client submission, assignment/status, public replies/internal notes, safe attachments and unread notification records.
- Files/modules: tickets, notifications; web inbox/detail/portal ticket features; counters/indexes.
- Concepts: scoped exceptions for assigned staff, monotonic counters, message visibility, append-only conversation history.
- Deliverables: submit → triage → reply → resolve, client-safe thread views.
- Tests: public/internal filtering, projectless ticket assignment, foreign client injection, duplicate submission, concurrent counter use, unauthorized reassignment.
- Completion criteria: assigned ticket access does not grant project access; no internal note in client responses; retry cannot duplicate cases.
- Risks: support expectations exceed MVP (no email ingestion or SLA automation), attachment visibility drift.

## Phase 9 · Real-Time Collaboration — planned

- Objectives: reduce stale UI while preserving durable correctness.
- Prerequisites: persistent notifications/outbox, policy-aware HTTP reconciliation, selected Redis adapter.
- Features: Socket.IO authentication, derived rooms, task/ticket/project hints, own notifications, reconnect refetch, membership/session disconnect. Rich chat/document co-editing excluded.
- Files/modules: realtime gateway, notifications dispatch, workers/outbox, web realtime integration.
- Concepts: at-most-once transport versus at-least-once jobs, consumer deduplication, ordering/versioning, sticky routing.
- Deliverables: safe live updates and reconnect experience with missed-event recovery via HTTP.
- Tests: unauthorized room attempts, duplicate/out-of-order hints, disconnect/reconnect, removed member, Redis/adapter outages, multiple API instances in staging.
- Completion criteria: HTTP remains source of truth; durable events reconcile; no protected broadcast after revocation check failure.
- Risks: adapter-specific recovery support, polling affinity and event storms; no exactly-once promise.

## Phase 10 · AI Assistant and RAG — planned

- Objectives: provide bounded, grounded internal assistance.
- Prerequisites: provider privacy/region approval, Atlas Vector Search capability/cost validation, clean extraction and knowledge ACLs, model/dimension selection, eval corpus.
- Features: knowledge ingestion/versioning, embeddings/vector index, ACL-prefiltered retrieval plus live checks, provider adapter, citations/output validation, atomic quota ledger, read-only Q&A/task drafts.
- Files/modules: ai, knowledge, quota repositories; workers/extract/embed; web FlowAI/knowledge; index migrations/evals.
- Concepts: embedding dimensionality, approximate retrieval, RAG versus training, prompt injection, eventual indexing, usage reservations.
- Deliverables: citation-based answers/refusal, revocation-safe sources, budget controls, provider outage handling, documented evaluation results.
- Tests: adversarial sources, foreign chunks, ACL revocation mid-flight, index lag, malformed output/citations, concurrent quota, timeout accounting, provider contract tests.
- Completion criteria: no Client AI or autonomous writes, no unfiltered retrieval, evaluated citation relevance/permission results and explicit unsupported-answer behavior.
- Risks: hallucination, provider content retention, latency/cost, changing index capability. Future write tools need a separate approved human-action design.

## Phase 11 · Analytics and SaaS Billing — planned

- Objectives: provide truthful delivery measures and subscription entitlements.
- Prerequisites: useful pilot data, validated plan/pricing hypotheses, payment provider and supported-country/tax review, webhook secrets and product catalog.
- Features: scoped task/ticket/AI aggregates, active catalog, hosted checkout/portal, verified webhook intake/reconciliation, entitlement limits, usage displays.
- Files/modules: analytics, billing, subscription models/jobs; web analytics/billing/pricing; provider adapter.
- Concepts: aggregation query plans, metric definitions, integer money, idempotent webhooks, out-of-order state, payment-versus-entitlement separation.
- Deliverables: reliable scoped metrics, sandbox subscription lifecycle and reconciliation runbook, explicit paid-through/grace policy.
- Tests: two-tenant aggregate filters, zero/no-data distinctions, signature rejection, duplicates/out-of-order events, cancellation/past-due, seat and AI concurrency limits.
- Completion criteria: browser redirects cannot grant plans; no card data stored; metrics carry scope/asOf, provider sandbox scenarios pass.
- Risks: commercial validation, tax/legal obligations, disputes, plan migration and billing-provider outage. No arbitrary live charges during implementation tests.

## Phase 12 · Security, Testing and Deployment — planned

- Objectives: demonstrate readiness under realistic failure/security conditions.
- Prerequisites: Phases 2–11 integrated, approved hosting/budget/secrets/region/retention, no critical policy gaps.
- Features: Docker production builds, Compose dev environment, GitHub Actions, infrastructure configuration, monitoring/alerts, backups/restores, deletion/export jobs, incident response, operational hardening.
- Files/modules: infra, CI workflows, operations docs, integration/e2e/load suites, security policies; changes only where tests expose defects.
- Concepts: least privilege, SLOs, recovery drills, supply-chain controls, CSP, load budgets, graceful shutdown and rollback.
- Deliverables: staging/pilot deployment, evidence report, restore drill, external security review, operator and support runbooks.
- Tests: full role/tenant regression, Vitest/Supertest/Playwright, a11y/manual assistive tech, dependency/secrets/container scans, reference-load test, queue/LLM/storage outage drills, backup restoration and purge manifest replay.
- Completion criteria: all required gates pass with evidence, no unresolved high/critical security findings, recovery targets measured or transparently revised, launch approval for production/external users.
- Risks: test infrastructure differs from Atlas/provider production, underestimated operating cost, deletion/backups and legal dependencies. Deployment approval follows preparation of a concrete reviewable artifact.

## Phase 13 · Documentation and Interview Preparation — planned

- Objectives: align docs with implemented behavior and teach defensible engineering decisions.
- Prerequisites: actual implemented/tested system and evidence from Phase 12; can update docs continuously before this phase.
- Features: developer setup, API/OpenAPI generation where implemented, architecture updates, runbooks, demo script, trade-off narratives, measured results and known limits.
- Files/modules: README, docs, ADR supersessions, generated API reference and interview guide; no fictional production case studies.
- Concepts: modularity, MongoDB indexes/transactions, tenant boundaries, cookie/CSRF lifecycle, eventual delivery, RAG safety, performance evidence and commercial scope.
- Deliverables: reproducible onboarding, honest demo data, interview questions grounded in code/tests, operating handoff.
- Tests: new-developer setup dry run, documentation links/commands, demo journey against release build and API reference drift checks.
- Completion criteria: every claimed capability matches deployed/tested scope, limitations explicit, architecture and onboarding independently reproducible.
- Risks: marketing overclaims, stale examples and exposing secrets in demos; scrub all public artifacts.
