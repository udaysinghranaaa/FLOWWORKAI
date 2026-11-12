# Phase 6 final implementation report

Date: November 12, 2026. Project: FlowWork AI, C:/FLOWWORKAI.

## 1. Executive summary

**Status: Complete and verified locally; live rollout remains blocked pending manual prerequisites.** Phase 6 implements real MongoDB-backed projects, project memberships, tasks, persistent Kanban ordering, assignments, one-level subtasks, plain-text comments, activity, My Tasks and authorized workspace metrics. The public demo remains separate. No Phase 7 work or GitHub push was performed.

**Live status remains BLOCKED/PENDING:** private credential rotation is unconfirmed, Phase 5 live tenant schema/onboarding remains unverified, and Phase 6 live schema requires separately approved initialization for the intended environment. Local passing tests and a read-only Atlas ping do not prove live tenant rollout.

## 2. Architecture changes

The existing Express modular monolith, JWT cookie/session checks, signed CSRF/origin policy, tenant context, error/logging contracts and DNS configuration are reused. Work routes validate strict body/query/params, controllers map transport, and the work service uses the existing tenant transaction and organization guards before writing scoped models. No second authentication or database connection system, new dependency, queue, socket, client portal or storage service was added.

Phase 5 exposes its existing write/organization guard internally and accepts a transaction session in workspace resolution. Current company/workspace memberships are rechecked inside work transactions. Server startup reports phase 6 only when a work runtime exists. Normal startup verifies declared work indexes and fails closed when absent.

The real React routes reuse the API client, TanStack Query, RHF/Zod, existing themed UI primitives and dnd-kit. Existing /w demo components and repository are unchanged.

See [architecture audit](phase-6-architecture.md) and [ADR 011](architecture-decisions/011-project-grants-and-task-ordering.md).

## 3. Database models

| Collection | Ownership and important fields | Validation/serialization |
|---|---|---|
| projects | immutable organizationId/workspaceId/createdBy, mutable ownerUserId, name/slug/description, status/previousStatus, priority/color, start/due dates, version, UUID key/digest | Strict Zod and Mongoose; safe explicit DTO; digest/key/internal version stripped from model JSON |
| projectMemberships | immutable tenant/project/user IDs, MANAGER/CONTRIBUTOR/VIEWER grant, active/revoked, timestamps | Grant never replaces active identity/tenant membership; owner removal protected |
| tasks | immutable tenant/project/reporter/parent IDs, title/description, status/priority, nullable assignee, labels/dates, position, version, completion/archive timestamps, UUID key/digest | Valid calendar dates; one-level parent; scoped eligibility; safe DTO |
| taskComments | immutable tenant/project/task/author IDs, plain text, version, deletedAt, UUID key/digest | 1-4,000 characters; own/authorized moderation; soft delete replaces displayed text; safe DTO |
| activityEvents | tenant/project, optional task, immutable actor, action, timestamp and bounded field/from/to metadata | Produced only by server transactions; no public write endpoint or secret payloads |

The existing 16 KiB JSON transport cap also applies, in addition to per-field character limits.

Project name: 2-120 characters; task title: 2-200; project description: 5,000; task description: 10,000; labels: up to ten unique trimmed values of 1-30 characters. Tenant foreign keys and actors are derived from authorized context, not writable request fields. Dates are UTC calendar dates, consistently returned as YYYY-MM-DD.

Project statuses: planned, active, on_hold, completed, archived. Task statuses: todo, in_progress, in_review, done. Priorities: low, medium, high, urgent. The backend configuration endpoint supplies real UI labels/defaults instead of duplicating presentation enums. The historical demo retains its independent enums.

## 4. Index definitions

| Collection | Declared indexes beyond _id |
|---|---|
| projects | unique organization/workspace/slug; unique workspace/creator/creationKey; organization/workspace/status/updatedAt/_id; organization/workspace/createdAt/_id |
| projectMemberships | unique project/user; organization/workspace/user/status/project |
| tasks | unique project/creator/creationKey; unique organization/workspace/project/parent/status/position for archivedAt=null; organization/workspace/project/archivedAt/updatedAt/_id; organization/workspace/assignee/archivedAt/dueDate/_id |
| taskComments | unique task/author/creationKey; organization/workspace/project/task/createdAt/_id |
| activityEvents | organization/workspace/project/createdAt/_id; organization/workspace/task/createdAt/_id |

Models disable autoCreate/autoIndex. Required key, unique and partial-filter metadata is checked read-only at normal startup. Indexes were installed only in generated isolated databases. A separate read-only metadata audit returned phase5SchemaReady=false and phase6SchemaReady=false; required index sets are incomplete. Readiness is not inferred from ping. No TTL deletes work records.

## 5. Backend API inventory

[OpenAPI 0.6](../backend/openapi.json) validates with **48 total path patterns**, including **24 work operations on 16 added patterns**. [Exact inventory](phase-6-api-inventory.md) lists every method/path and the contract defines payloads.

Operational groups: authenticated configuration; workspace projects create/list; nested project details/edit/archive/restore/owner transfer; project grants list/change/remove; workspace or project task lists; task create/read/edit/archive/restore/assignment; versioned move; paginated board; nested subtask create/list; comment create/list/edit/soft-delete; project/task activity; workspace dashboard.

Unsafe operations use the existing exact Origin, cookie and signed CSRF checks. No project/task hard-delete endpoint or bulk arbitrary-update endpoint exists. Strict unknown-field rejection prevents injected tenant IDs, actors and roles.

## 6. Authorization matrix

Current workspace role below includes the explicitly inherited Phase 5 company OWNER/ADMIN authority. Every row still requires current active identity and company/workspace access.

| Effective role / project grant | Read | Create project | Manage project, grants, owner and moderation | Create/edit/assign/archive tasks and comments |
|---|---|---|---|---|
| OWNER or ADMIN | all projects in scope | yes | yes | yes |
| MANAGER + MANAGER grant or project ownership | granted/owned project | yes | that project | yes |
| MANAGER + CONTRIBUTOR grant | that project | yes | no | yes |
| MEMBER + CONTRIBUTOR grant | that project | no | no | yes |
| MANAGER/MEMBER + VIEWER grant | that project | role-based creation only for MANAGER | no | no |
| VIEWER + any grant | that project | no | no | no |
| No grant/ownership and no admin inheritance | concealed | MANAGER can create its own | no | no |

A stale MANAGER grant cannot elevate a MEMBER into project management, and VIEWER always remains read-only. Project grants cannot reinstate revoked workspace membership. Owners must transfer before their project membership can be removed. The new owner must be an active eligible project administrator, and transfer ensures its manager grant. Founding organization/workspace ownership remains unchanged and immutable.

Task assignment validates active verified account, organization/workspace access and project contribution eligibility. Removing a project grant unassigns its tasks. Revoking workspace access immediately denies project reads and future assignment; a retained historical assignment is flagged ineligible so an administrator can reassign/unassign it. An assignment itself never grants access.

Comment editing/deletion is permitted only for its author or a project administrator, subject to current contribution capability and active records. VIEWER cannot mutate even its previous comments. Archived projects/tasks are read-only except eligible restoration.

## 7. Frontend changes

Real routes:
- /app/w/:workspaceId/overview: real metrics, assignments/deadlines and recent projects.
- /app/w/:workspaceId/projects: searchable, filtered, sorted and paginated real cards with owner, member preview, progress and deadline.
- /app/w/:workspaceId/projects/:projectId: header/description/progress, edit/archive/restore, ownership and grants, task list, board and activity.
- /app/w/:workspaceId/projects/:projectId/tasks/:taskId: task fields, reporter/assignee, labels/dates, edit/archive/restore, subtasks, comments and history.
- /app/w/:workspaceId/tasks and /my-tasks: combined server filters, stable pagination and authorized quick status updates.

Forms preserve entered details and retry keys on failure. Edits retain their original record version; errors do not silently overwrite concurrent changes. Real pages use truthful loading, empty, error/retry and denied states. Filters and pickers have bounded pages, including project/assignee options. Query keys include identity/workspace/project. Workspace switching cancels old tenant requests and removes old workspace cache; logout clears the query cache. Permission hiding assists UX; the backend remains authoritative.

Dark/light/system themes and public marketing/demo pages are preserved. No authenticated demo metrics or fictional projects/tasks appear as company data.

## 8. Kanban ordering strategy

Each active column/group has unique scoped integer positions. New cards append into gaps of 1,024; neighbor moves choose an integer midpoint. Normal movement changes one task, the project revision, transaction guards and its activity event. Only exhausted gaps trigger bounded transactional rebalance: temporary negative values avoid unique collisions, then valid positive gaps are written before commit. Position arithmetic avoids unsafe integer addition.

Board GET loads twenty cards per column by default, maximum fifty, with totals and per-column continuation cursors. UI continuation requires the same project revision; otherwise it refreshes. Subtasks have their own ordering group and are not top-level board cards. Archived cards are excluded; restoration appends safely.

The move API requires current task version and boardVersion, desired status and nullable beforeId. Shared project/organization guards serialize writers. Optimistic previews cancel old fetches, disable duplicate moves, reconcile on success and roll back/refetch on errors. A network failure cannot prove whether the server committed, so refetch determines final persisted state.

Pointer-aware collision detection chooses the actual hovered column/card. Keyboard dnd support, status menus and up/down buttons provide alternatives. Reordering beyond an unloaded neighbor requires loading more; dropping into column background appends. Save/error messages are live announcements.

## 9. Comment and activity design

Comments are plain text rendered by React text nodes; HTML/script text is not executed. Authors and authorized moderators can version-edit or soft-delete. Lists show author and timestamps and use bounded cursor pages.

Meaningful project/task changes, assignments, status/completion, priority/date changes, comments and membership actions produce server-owned activity in the same transaction. An activity insertion failure rolls back its business write. Metadata holds field names and bounded transitions, not passwords, tokens or comment bodies. No client actor/timestamp override or activity-write API exists.

Subtasks are one level, immutable-parent, same-project/same-tenant. A parent that is itself a subtask cannot receive children. Completion is independent: children do not auto-complete a parent. Parent archive atomically archives children. Restoring a parent leaves children archived until explicitly restored.

## 10. Test commands

In backend: npm.cmd run typecheck, lint, test, build and format:check. The test configuration retains Vitest and all prior tests, isolates process-mutating entrypoint cases in a fork, and reuses one application thread to bound native-worker churn on Windows. Files run serially; startup/cleanup hooks remain bounded. Replica-set fixtures never load .env and reject non-generated/non-loopback cleanup.

In frontend: npm.cmd run typecheck, lint, test, build, format:check and test:e2e. Browser global setup builds the actual backend and starts the compiled listener with generated loopback databases, random signing configuration and controlled mail recipients.

Operational read-only commands executed: npm.cmd run schema:work (static plan, no connection/writes) and npm.cmd run db:check (sanitized ping). No apply command or normal Atlas-backed server startup was executed.

## 11. Test results

| Check | Actual evidence |
|---|---|
| Backend full suite | **206 passed in 14 files**, preserving all 169 earlier cases and adding 37 Phase 6/safety cases |
| Final startup safety and preserved DNS tests | 9 passed in two files (five new guard cases plus four existing DNS cases) |
| Final all-backend rerun | PASS 206, with no failed/skipped cases or unhandled errors |
| Frontend full suite | 47 passed in six files, preserving 35 earlier cases |
| Typecheck / lint | Passed in backend and frontend |
| Production builds | Passed in backend and frontend |
| Formatting | Passed; final recheck recorded with completion |
| OpenAPI | Validated by preserved contract tests |
| Schema plan | mode=plan, writes=false; five collection/index plans |
| Read-only Atlas | connected=true, pingSucceeded=true; phase5SchemaReady=false, phase6SchemaReady=false from index metadata |

Initial verification exposed a Zod composition error, a PATCH-default regression risk, pointer collision behavior and modal autofocus interfering with focus return. These were corrected. A one-shot UI error mock was changed to model a persistent failure until retry. Initial Windows native worker exits and replica-set startup/cleanup timeouts were not counted as passes; separating process-mutating tests from the reused application worker produced the clean 201-case run.

New backend coverage includes atomic creation/retry, grants/owner transfer, role ceilings, all tenant resource boundaries, eligibility and revocation, combined filters/cursors/date validation, stale edits, persistent/concurrent moves, gap rebalance, one-level subtasks/archive behavior, comment authorization and transaction rollback. A controlled 200-task fixture verifies bounded list/column payloads and exact aggregate counts; it is not a throughput benchmark.

New frontend coverage includes API-backed rendering, validation, confirmed creation, network retry keys, task assignment/codes/labels, stale edits, My Tasks filters, optimistic rollback, viewer controls, plain-text rendering and honest zero metrics.

## 12. Browser verification

**Complete browser suite: 146 passed in 8.2 minutes**, including all 143 preserved cases and the three Phase 6 real-server journeys. Pointer move/order persistence, viewer restrictions, comments/subtasks, dashboard counts, archive/restore and logout/login persistence all passed.

Two initial Phase 6 journeys passed: real project/task/assignment/comments/subtask/metrics/reload/login/archive/restore, and verified viewer grants/403 plus foreign workspace concealment/404. The pointer test first exposed collision handling, then verified movement/reordering and reached passing contrast scans but found focus restoration affected by form autoFocus. Explicit autoFocus was removed so the existing Radix dialog trigger restoration is respected. The corrected full-suite run passed all 146 cases.

The preserved public demo, auth/session/email/reset, Phase 5 onboarding/invites/tenant switching and theme cases are retained.

## 13. Accessibility results

**31 axe scans passed within the complete suite:** 28 preserved scans plus two real-board theme scans and the real task-dialog scan. Pointer movement, reorder/status alternatives, Escape focus restoration and mobile overflow checks passed.

Coverage uses existing axe checks plus new real-board light/dark scans and the real task dialog scan. New interactions exercise a pointer drag, persisted order, status-menu and reorder-button alternatives, Escape focus return and a 390px page-overflow assertion. Fields reuse existing labeled/error-linked primitives; board handles/actions have explicit accessible names and save/error announcements.

No unsupported accessibility certification or blanket performance claim is made.

## 14. Performance considerations

List defaults are 20/max 50; workspace projects are capped at 1,000, project task records at 10,000 and active grants at 1,000. Cursors use sort value plus ObjectID; task due-date order is ascending with undated items first. Board pages are independently bounded. Member/user lookups and preview aggregates are batched, avoiding per-card user queries. Dashboard counts use database aggregation over accessible project IDs; the browser does not fetch every task for counts.

The organization/project guards trade high write concurrency for correct revocation and ordering at this stage. Rebalance is exceptional; ordinary moves do not rewrite an entire board. Literal bounded search does not claim a full-text index or guaranteed large-tenant latency. No Redis or queue was added. Future scale work should measure real query plans and preserve tenant predicates.

## 15. Security findings

Authentication, CSRF, exact CORS, current sessions, DNS startup and ignored secrets are preserved. Tenant/project IDs are validated and verified against current context, including subordinate task/comment/member references. Project cursors remain inside authorization predicates rather than replacing them. PATCH schemas omit creation defaults. Writes and activity are atomic; stale versions fail with 409. Unknown or foreign resources return concealed 404.

Automatic test provisioning now additionally requires an exact generated loopback namespace at the real server entrypoint, before any auth/tenant/work schema creation. NODE_ENV=test alone cannot initialize schema on Atlas or another customer database. The guard has direct positive/negative tests with static errors that do not expose host/database values.

The targeted scan found no configured connection URI, signing secret, database password, username or cluster hostname (where long enough for a meaningful exact-value match) in source/tests/docs. No invalid UTF-8 or broken Phase 6 links were found. Git tracking excludes backend/.env and private mail capture; its ignore rules remain.

No real credential rotation, Atlas business/schema write, destructive live cleanup, private IDE token use or GitHub push was performed.

## 16. Known limitations

- Live schema and manual real-Atlas flows are pending; local success does not close that gate.
- One-level subtasks, fixed initial status configuration and explicit archive/restore; no recursive hierarchy, custom workflow designer or hard-delete work endpoint.
- Project work shares a broad organization guard, favoring correctness over maximal write throughput.
- Bounded substring search and fixed product caps; no unmeasured large-tenant performance guarantee.
- Existing public demo enums remain independent; authenticated labels come from the backend.
- Historical assignments may remain after workspace revocation, are flagged ineligible and do not grant access; explicit project-grant removal unassigns its tasks.
- No real-time collaboration/chat, file attachments, clients, billing or Phase 7 functionality.
- Installed Zod dependencies emit harmless Rollup annotation warnings; no dependency changes were made.
- Windows process-sensitive tests require the documented pool isolation; earlier failed runs remain recorded above.

## 17. Phase 5 dependencies

Reuse Phase 5 current user/session and membership checks, immutable company/workspace founding ownership, invitations/onboarding, authorized workspace context and cache lifecycle. Existing tenant write/organization guards are exposed internally rather than duplicated.

The owner last confirmed credential rotation was still required. No later confirmation was inferred. Read-only metadata confirms the required Phase 5 index set is incomplete. Normal live tenant readiness and real company onboarding remain pending, and the Phase 6 index set is also incomplete. Read-only Atlas ping was successful on this task, separately from tenant acceptance.

## 18. Safe schema initialization plan

The default command is reviewable and non-mutating:

    Set-Location C:/FLOWWORKAI/backend
    npm.cmd run build
    npm.cmd run schema:work

It prints only five collection/index definitions and requirements, without a database connection. No apply operation was run.

Before any future live apply: privately rotate disclosed Atlas/JWT credentials; confirm the intended environment and database privately; review existing collection/index conflicts and an appropriate backup; complete approved Phase 5 initialization and readiness; obtain separate Phase 6 schema approval. Only then, the operator can explicitly acknowledge the approved environment:

    npm.cmd run schema:work -- --apply --rotation-confirmed --schema-approved --approved-for=development

Use production only when that is the separately approved NODE_ENV; mismatches fail. The CLI refuses test mode, requires rotation/schema/environment acknowledgment, configures optional DNS before connecting, checks Phase 5 index readiness, then only creates declared work collections/indexes. It does not seed examples, drop indexes/collections or delete records. Existing conflicting data/indexes must be reviewed manually; the script does not silently migrate them.

## 19. Manual live verification steps

After approved rotation/schema rollout, start the normal backend/frontend. Use only controlled accounts and private capture links. Register/verify/login, create a company/workspace through real onboarding, create a project and an eligible project grant, assign a task, edit priority/date/labels, create a subtask, post/edit a plain-text comment, move/reorder and reload, check actual counts and My Tasks, then archive/restore the project and verify persistence after logout/login.

Repeat with a verified VIEWER who has a project grant: reads work and mutations fail. Use another company/workspace to demonstrate concealed project/task/comment/history and aggregate boundaries. Revoke membership and confirm existing cookies no longer authorize project access. Never run destructive Atlas fixture cleanup; keep all credentials and action links private.

## 20. Phase 7 readiness

The project/task foundation provides explicit tenant keys, current role/grant evaluation, scoped models/indexes, bounded APIs, transactions, history and real UI integration. This is an integration boundary for future authorized work, not authorization to start Phase 7. Do not add clients/portal, real-time, AI or billing in this phase.

### Definition of done

| Item | Local status |
|---|---|
| Project CRUD via create/read/update/archive/restore | Implemented; isolated API/browser evidence |
| MongoDB tasks, assignment/status/priority | Implemented; isolated API/browser evidence |
| Project membership and owner transfer | Implemented; API tests and real UI controls |
| Filters, sort and pagination | Implemented; API/UI tests |
| Persistent Kanban/reordering | PASS complete browser suite |
| Subtasks and comments | Implemented; API/browser evidence |
| Atomic activity | Implemented; rollback tests |
| My Tasks and real dashboard metrics | Implemented; API/browser evidence |
| Real authenticated APIs and separate demo | Implemented; PASS complete browser suite |
| Phase 5 RBAC and tenant isolation | Preserved; current-role and foreign-resource tests |
| Backend/frontend tests and builds | See actual results in section 11 |
| Browser/accessibility/security gates | PASS browser/accessibility; see security checks above |
| Documentation and live blockers | Recorded; live rollout remains pending |

### Exact changed-file inventory

Inventory compares SHA-256 hashes captured before Phase 6 changes. Generated builds/test artifacts and ignored capture files are excluded. No files were removed. Previous phase reports, backend/.env, DNS source and public demo fixtures/repository are preserved.

Created (29):

- [backend/src/commands/initialize-work.ts](../backend/src/commands/initialize-work.ts)
- [backend/src/lib/test-schema-target.ts](../backend/src/lib/test-schema-target.ts)
- [backend/src/modules/activity/activity-event.model.ts](../backend/src/modules/activity/activity-event.model.ts)
- [backend/src/modules/projects/project-membership.model.ts](../backend/src/modules/projects/project-membership.model.ts)
- [backend/src/modules/projects/project.model.ts](../backend/src/modules/projects/project.model.ts)
- [backend/src/modules/tasks/task-comment.model.ts](../backend/src/modules/tasks/task-comment.model.ts)
- [backend/src/modules/tasks/task.model.ts](../backend/src/modules/tasks/task.model.ts)
- [backend/src/modules/work-management/work.constants.ts](../backend/src/modules/work-management/work.constants.ts)
- [backend/src/modules/work-management/work.controller.ts](../backend/src/modules/work-management/work.controller.ts)
- [backend/src/modules/work-management/work.fields.ts](../backend/src/modules/work-management/work.fields.ts)
- [backend/src/modules/work-management/work.models.ts](../backend/src/modules/work-management/work.models.ts)
- [backend/src/modules/work-management/work.routes.ts](../backend/src/modules/work-management/work.routes.ts)
- [backend/src/modules/work-management/work.schema.ts](../backend/src/modules/work-management/work.schema.ts)
- [backend/src/modules/work-management/work.service.ts](../backend/src/modules/work-management/work.service.ts)
- [backend/tests/unit/test-schema-target.test.ts](../backend/tests/unit/test-schema-target.test.ts)
- [backend/tests/work-management.test.ts](../backend/tests/work-management.test.ts)
- [docs/architecture-decisions/011-project-grants-and-task-ordering.md](../docs/architecture-decisions/011-project-grants-and-task-ordering.md)
- [docs/phase-6-api-inventory.md](../docs/phase-6-api-inventory.md)
- [docs/phase-6-architecture.md](../docs/phase-6-architecture.md)
- [docs/phase-6-final-report.md](../docs/phase-6-final-report.md)
- [frontend/src/features/work-management/use-work.ts](../frontend/src/features/work-management/use-work.ts)
- [frontend/src/features/work-management/work-collaboration.tsx](../frontend/src/features/work-management/work-collaboration.tsx)
- [frontend/src/features/work-management/work-forms.tsx](../frontend/src/features/work-management/work-forms.tsx)
- [frontend/src/features/work-management/work-kanban.tsx](../frontend/src/features/work-management/work-kanban.tsx)
- [frontend/src/features/work-management/work-pages.tsx](../frontend/src/features/work-management/work-pages.tsx)
- [frontend/src/features/work-management/work-task-detail.tsx](../frontend/src/features/work-management/work-task-detail.tsx)
- [frontend/src/features/work-management/work-ui.tsx](../frontend/src/features/work-management/work-ui.tsx)
- [frontend/src/services/work-api.ts](../frontend/src/services/work-api.ts)
- [frontend/src/test/work.test.tsx](../frontend/src/test/work.test.tsx)

Modified (23):

- [AGENTS.md](../AGENTS.md)
- [README.md](../README.md)
- [backend/openapi.json](../backend/openapi.json)
- [backend/package.json](../backend/package.json)
- [backend/src/app.ts](../backend/src/app.ts)
- [backend/src/modules/auth/auth.routes.ts](../backend/src/modules/auth/auth.routes.ts)
- [backend/src/modules/health/health.service.ts](../backend/src/modules/health/health.service.ts)
- [backend/src/modules/memberships/permissions.ts](../backend/src/modules/memberships/permissions.ts)
- [backend/src/modules/organizations/tenant.service.ts](../backend/src/modules/organizations/tenant.service.ts)
- [backend/src/routes/index.ts](../backend/src/routes/index.ts)
- [backend/src/server.ts](../backend/src/server.ts)
- [backend/tests/auth-fixture.ts](../backend/tests/auth-fixture.ts)
- [backend/tests/unit/openapi.test.ts](../backend/tests/unit/openapi.test.ts)
- [backend/vitest.config.ts](../backend/vitest.config.ts)
- [docs/02-roles-and-permissions.md](../docs/02-roles-and-permissions.md)
- [docs/03-system-architecture.md](../docs/03-system-architecture.md)
- [docs/05-api-design.md](../docs/05-api-design.md)
- [docs/09-development-roadmap.md](../docs/09-development-roadmap.md)
- [frontend/e2e/auth.spec.ts](../frontend/e2e/auth.spec.ts)
- [frontend/src/features/workspaces/tenant-shell.tsx](../frontend/src/features/workspaces/tenant-shell.tsx)
- [frontend/src/features/workspaces/workspace-overview.tsx](../frontend/src/features/workspaces/workspace-overview.tsx)
- [frontend/src/routes/router.tsx](../frontend/src/routes/router.tsx)
- [frontend/src/styles/index.css](../frontend/src/styles/index.css)

