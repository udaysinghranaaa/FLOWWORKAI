# 01 · Product requirements

Status: Phase 1 design complete; all product capabilities below are **planned**, not implemented. Product owner approval and real customer discovery remain prerequisites to commercial commitments.

## Vision and mission

**FlowWork AI — One Workspace. Every Workflow. Powered by AI.**

Give software development and digital marketing agencies one accountable place to coordinate delivery, communicate with clients and retrieve trusted knowledge. Replace scattered project updates, chat requests, files and spreadsheets with shared workflows whose visibility is explicit.

The initial customer hypothesis is an agency with 5–50 internal staff, several concurrent client engagements and a dedicated delivery lead. This is a scope assumption, not verified market demand. Software agencies need milestones, actionable technical tasks and client approvals; marketing agencies need campaign deliverables, recurring coordination and clear external visibility. Full accounting, advertising execution and source-code hosting are outside the product boundary.

## Personas, problems and positioning

| Persona | Current problem hypothesis | Desired outcome |
|---|---|---|
| Agency owner | Cannot see delivery risk or subscription spend in one place | Understand workload and own workspace governance |
| Operations admin | Repeats invitations, permissions and client setup | Manage staff and clients safely |
| Project manager | Status updates live in several tools | Assign work, manage milestones and publish approved updates |
| Team member | Priorities and client context are unclear | See assigned work and collaborate without exposing internal notes |
| Client contact | Must ask staff for every update | Review explicitly shared deliverables and raise support tickets |

Primary segments: small software consultancies and digital marketing agencies. Secondary segment after validation: mixed-service agencies. Positioning hypothesis: project delivery plus a deliberately constrained client portal and permission-aware knowledge assistant, rather than an unrestricted all-purpose workspace. Existing alternatives include project tools, document tools and help desks; feature breadth alone is not defensible. Validate whether reduced handoffs and trusted client visibility justify switching costs. No competitive superiority or customer adoption is claimed.

## Proposed success measures

Targets are discovery and pilot goals, not measured results: 70% of pilot workspaces create a client, project and five tasks within seven days; reduce a participating team's weekly status-report preparation time by 25% versus its own recorded baseline; 60% of invited pilot client contacts view an assigned project within 14 days; fewer than 5% of pilot AI answers receive a permission/citation complaint. Measure activation events with consent, exclude staff/test accounts, record baseline sample size, and review after a 4–6 week pilot. Track paid conversion, cancellation reasons and gross margin only when billing and real cohorts exist; do not forecast revenue from invented demand.

## Module requirements and scope

| ID | Module | Minimum launch behavior | Later scope |
|---|---|---|---|
| FR01 | Authentication | Email/password, verification, reset, secure sessions, device logout | Enterprise SSO, passkeys, mandatory MFA policies |
| FR02 | Workspaces | Create, switch, rename, export/delete request; strict isolation | Region selection and enterprise hierarchy |
| FR03 | Employees/teams | Workspace membership and project groups through access grants | Dedicated departments, teams collection, capacity planning |
| FR04 | Clients | Directory and contacts; invite linked client identities | CRM pipelines and external CRM integrations |
| FR05 | Projects | Client link, staff access grants, lifecycle and visibility | Templates, portfolios, recurring projects |
| FR06 | Tasks/Kanban | Fixed backlog/todo/in_progress/review/done states, assignments, due dates, versioned moves | Custom workflows, dependencies and automation |
| FR07 | Collaboration | Text comments, explicit internal/client visibility, scanned attachments | Rich document collaboration and version comparison |
| FR08 | Client portal | Granted projects, published tasks/milestones, own-client tickets | Approval workflows and white labeling |
| FR09 | Tickets | Client-submitted tickets; staff assignment, public replies/internal notes | SLA automation, email ingestion, omnichannel support |
| FR10 | Notifications | Durable in-app records, unread state, real-time hints | Preferences, digest and browser push |
| FR11 | FlowAI | Permission-filtered Q&A and draft task descriptions; citations and usage budgets | Approved write actions and agent workflows |
| FR12 | Knowledge/RAG | Private documents, extraction, embeddings, filtered retrieval, source revocation | External connectors and hybrid search tuning |
| FR13 | Analytics | Task counts, overdue work, ticket aging and AI usage | Forecasting, time tracking and profitability |
| FR14 | Subscriptions | Plan entitlements, hosted checkout/portal, verified webhooks | Tax expansion, usage invoicing and custom contracts |

Launch MVP includes the minimum columns after Phases 2–12 pass their gates. Phase 1 contains no working MVP. AI is advisory/read-only at launch; no autonomous task, billing or permission changes. Client AI is disabled at launch pending an external-data threat review. Employee means internal workspace member, not payroll management. Milestones represent delivery dates/status, not legally binding acceptance or electronic signatures.

## Role journeys

**Owner:** sign up → verify email → create workspace → select plan/trial entitlement → invite an Admin and staff → create a client/project → inspect delivery totals → manage subscription → transfer ownership or request deletion after reauthentication. Workspace creation atomically creates the owner membership; a workspace cannot become ownerless.

**Admin:** accept invitation with matching verified email → configure branding and client directory → invite staff at Manager/Member/Client level → add project grants → monitor tickets → remove departing staff. Admin cannot promote owners/admins, change billing or delete the workspace.

**Manager:** accept staff invite → see assigned projects → create a project (automatically obtain its manager grant) → assign eligible project members → move tasks → publish a deliverable intentionally → respond to client tickets → review project analytics. Cannot see unassigned projects or workspace-wide analytics.

**Member:** open My Work → select an assigned project → create task or update allowed fields on an assigned/created task → comment internally → attach scanned material → follow notification to a fresh, authorized view. Cannot publish content to clients.

**Client:** accept invitation linked to exactly one client account per workspace → open portal → see grants and explicitly published artifacts only → comment publicly → download a permitted clean attachment → submit ticket → receive public staff replies. Internal task fields, notes, AI, staff directory and other clients are absent from responses.

## Functional invariants

- Every tenant record has a workspace context; foreign IDs are validated against that context before use. User identity alone never grants workspace access.
- A project grant is required for Manager/Member project work. Owner/Admin have internal workspace-wide project access. Client access additionally requires matching clientId, an explicit grant and published visibility.
- Only Owner/Admin/assigned Manager can publish tasks, milestones or attachments. Comments inherit parent access and have their own visibility; an internal parent cannot be exposed through a public child.
- Task writes use an expected version. Concurrent edits return 409 with refresh guidance; failed optimistic updates roll back.
- Invitations are expiring, single use and email-bound. Repeated acceptance cannot create duplicate memberships.
- Notifications and socket events never serve as authorization; clicking a stale record may yield 404.
- Entitlements are evaluated server-side; service outages never silently enable paid or unlimited AI capabilities.

## User stories and acceptance criteria

| Story | Testable acceptance criteria |
|---|---|
| US01 Owner creates workspace | With a verified account and valid unique slug, creation returns 201 and one active owner; transaction failure leaves neither partial record |
| US02 Admin invites staff | A valid email/role invitation returns 202; expired token returns 410; email mismatch cannot consume it; duplicate active invite returns 409 |
| US03 Manager creates task | Assigned manager posts valid project/assignee/version data and receives 201; foreign-workspace assignee yields 422 without disclosing identity |
| US04 Member moves task | Assigned/created task at version 3 moves to review and version 4; another version-3 write returns 409; unassigned task write returns 403 |
| US05 Client reads project | Granted project returns only public DTO fields; internal task lookup returns 404; another client's project returns 404 |
| US06 Staff publish attachment | File remains inaccessible while pending/quarantined; clean file with explicit client publication becomes downloadable only through fresh authorization |
| US07 Client opens ticket | Ticket is linked to server-derived clientId; public reply is visible, internal note is excluded from list/detail/socket responses |
| US08 Member removed | Next request and next socket event are rejected; room access is revoked; old notification and signed-link residual limits are recorded |
| US09 FlowAI answers | Retrieval returns authorized active sources, answer cites source IDs; revoked source before final response causes exclusion/regeneration or refusal; exhausted quota returns 429 |
| US10 Billing retries | A valid duplicate provider event returns success without double entitlement changes; invalid signature changes nothing |
| US11 Last owner removed | Concurrent demotions/removals cannot leave zero active owners; one succeeds at most, the other returns 409 |
| US12 Keyboard user edits task | Task panel opens and closes by keyboard, restores focus and announces save/failure; board has a non-drag status control |

## Non-functional requirements and proposed budgets

These are engineering acceptance targets to benchmark, not observed metrics or contractual SLAs. Reference pilot load: 100 concurrent active users across 20 workspaces, up to 10,000 tasks per workspace, paginated lists of 50, same-region API/database; exclude LLM, file-transfer and third-party latency from core API measures.

| Area | Proposed acceptance target / verification |
|---|---|
| Core API | p95 ≤500 ms reads, ≤800 ms writes under reference load, error rate <1%; disclose query and network assumptions |
| Frontend | p75 LCP ≤2.5 s, INP ≤200 ms, CLS ≤0.1 on representative mobile; measure in pilot, not asserted now |
| Real-time | Connected users receive hints within 2 s p95; reconnect always reconciles durable HTTP state |
| Availability | Initial service objective 99.5% monthly; excludes no outages until policy defined, no paid SLA promised |
| Recovery | Candidate RPO ≤24 h and RTO ≤8 h; verify configured backup tier and restoration drills before launch |
| Accessibility | WCAG 2.2 AA target; keyboard, screen-reader and contrast review on every critical journey |
| AI | 30 s synchronous budget then timeout; ingestion async; track latency, citation validity, cost and denial rate |
| Security | Zero unresolved critical/high issues before external pilot; tenant/role negative tests are release gates |

## Assumptions, risks and dependencies

No validated customers, price points, production stack versions or operating budget exist. Agency workflow assumptions require interviews. Atlas Vector Search availability/cost, LLM regional processing and retention, transactional MongoDB deployment, payment provider, email delivery, malware scanning and private storage must be selected before their implementation phases. Redis is proposed supporting infrastructure for jobs and distributed Socket.IO/rate limits (ADR 006); it is not an additional application service boundary. Recovery objectives depend on paid infrastructure capabilities. Billing tax/geography and legal retention require qualified review before sales. Pilot prioritization may reduce breadth; any MVP scope change must update this document, roadmap and API contracts together.
