# Phase 7 — Implementation report

## 1. Executive summary

FlowWork AI now has MongoDB-backed agency client CRM and a separate authenticated client portal. It reuses existing identity, tenancy and project authorization. The public demo remains independent. Local implementation and live rollout are separate: Atlas rollout is not complete. Phase 8 is unstarted.

## 2. Implementation status

Implemented: client lifecycle, contacts, invitations, scoped portal roles, explicit sharing, publication, milestones, feedback/replies, reviewed change requests, authorized task linking, deliverables, approvals and audit. Final verification results appear in section 15. No commit or GitHub push was performed.

## 3. Existing architecture reused

Express/Zod, cookie authentication, verified identity, refresh/CSRF, tenant identity/session transaction locks and organization guard, Phase 6 project capabilities, Mongoose, existing DNS setup, private mail capture/SMTP adapter, React Router/Query/RHF, design tokens/components, generated replica-set fixtures and compiled-server browser harness. Earlier phase reports remain unchanged.

## 4. New data models

Seven collections: `clients`, `clientContacts`, `portalMemberships`, `portalInvitations`, `clientProjectGrants`, `clientResources`, `clientAuditEvents`. Resources discriminate progress, milestone, feedback, reply, change and deliverable. Ownership references are scoped and immutable. Contacts do not create identities. Replacement deliverables are separate revisions, preserving earlier decisions. Archive operations retain history.

## 5. Index definitions

`npm.cmd run schema:clients` in backend prints seven collections and 19 indexes without connecting. Unique indexes protect create retries, normalized client/contact email, one active primary contact, client/user membership, invitation hash and pending client/contact, client/project grant and deliverable predecessor. Compound scoped indexes serve lists, replies, publication, milestone order/due dates and audit. Additive initialization is tested idempotently in isolated MongoDB only.

## 6. API endpoint inventory

34 new operations on 24 added path patterns; OpenAPI now contains 72 patterns. See [exact inventory](phase-7-api-inventory.md) and [OpenAPI](../backend/openapi.json). Internal CRM starts at `/api/v1/workspaces/:workspaceId/clients`; external access starts at `/api/v1/portal/clients`. Strict request contracts derive from executable Zod schemas. External project/resource responses use explicit allowlists.

## 7. Authentication design

One existing identity/password system serves both contexts. Invitation acceptance requires matching verified email, active identity/session, current issuer authorization and active contact/client. Secrets use existing 256-bit randomness and SHA-256 hashing, explicit expiry, single-use consumption, replay protection and cooldown-based replacement. Existing active memberships never gain stronger roles through acceptance. Browser continuation is module memory only, clears on logout and never enters query keys or browser storage. Cookie, CSRF and refresh protections remain authoritative.

## 8. Internal versus external RBAC

Workspace OWNER/ADMIN manages CRM, contacts, invitations, representatives and sharing. Publication/review additionally requires current project manage permission. Project managers can use collaboration endpoints only for projects they currently manage. CLIENT_VIEWER is read-only. CLIENT_MEMBER/CLIENT_ADMIN may contribute when explicitly granted and approve only with approval permission. Agency-enabled CLIENT_ADMIN can manage existing non-admin representatives, but cannot grant admin, manage itself or reactivate revoked access. Agency users cannot impersonate client approvals. See [the matrix](02-roles-and-permissions.md).

## 9. Client isolation design

Every external request checks active company, workspace, client, contact, membership, project and grant. Resource predicates also include tenant/client/project and publication. Replies require an authorized published parent thread. Portal membership creates no employee memberships. Mutations reauthorize inside guarded transactions, serializing against membership/grant/archive changes. Foreign IDs remain unavailable.

## 10. Project sharing architecture

Client and project must share the current authorized workspace/company. Separate grants contain deliberately approved title/description and independent progress, milestones, deliverables, feedback, changes and approval switches. Revocation denies subsequent requests. Internal projects/tasks, employee details, comments and activity never serialize to the portal. Later internal fields do not expand the external contract.

## 11. Publication and visibility architecture

Progress starts as a draft and publishes explicitly; percentages are agency-approved manual values. Milestones have status, publication, due date and paginated display order. Deliverables publish from draft to shared; later content changes require a new revision. Internal replies may remain private. Archived/superseded resources disappear from normal client views while records and decisions remain.

## 12. Client portal implementation

`/portal` lists memberships. `/portal/:clientId` provides real shared-project and pending-approval counts, published updates, milestones and feedback. `/portal/:clientId/projects/:projectId` shows policy-filtered sections. Empty clients receive portal guidance, not employee onboarding. Separate navigation, existing profile/signout, identity/scoped query keys, fresh authorization gates and context-cache cleanup preserve isolation. Ten-second polling updates open pages; API revocation is immediate for later requests, while already rendered information cannot be recalled instantly.

## 13. Feedback and approval workflows

Clients submit feedback, edit their own open feedback and reply in shared threads. Agencies acknowledge, resolve, close and respond publicly or privately. Changes follow submitted → under_review → approved/rejected → completed; task linkage checks current internal project rights and same-project active tasks. Portal responses omit task IDs/details. Approval requires a non-viewer role and grant. Versions reject stale/concurrent decisions; new deliverables inherit no approval. Audit and business updates commit atomically, including tested rollback on audit failure.

## 14. Frontend pages/components

New client-management components cover internal list/profile/forms, contact/access/sharing, project collaboration, portal dashboard/navigation/invitation and scoped query helpers. A typed API module reuses existing transport. Forms use RHF, labels/errors, pending states, access-revocation confirmation and retry keys. URL section state survives reload. Cards, badges, progress and themes reuse existing styles. No business data enters localStorage. Demo fixtures/repository remain unchanged.

## 15. Test counts

Backend: **253 tests passed in 15 files**, including 47 new Phase 7 cases. Frontend: **62 tests passed in 7 files**, including 15 new cases. Full Playwright: **148 passed**, including two new full-stack scenarios and **37 axe scans** overall. Backend/frontend typecheck, lint, build and format:check passed. Git diff whitespace check passed. Static schema plan passed with writes=false. Read-only Atlas ping passed.

During development, stricter production-build typing required optional-field normalization; the initial browser workflow hit the normal IP budget at automation speed, so only the generated-loopback test server received a higher budget. A task-link confirmation was moved outside a collapsing panel, and the revocation browser assertion now waits for committed UI confirmation. Some concurrent Windows test invocations exited without a completed result; they were not counted as passes. The final complete backend run exited 0 (253/253), and the full browser run exited 0 (148/148). Sandbox browser runs completed cases but stalled at process cleanup; the final full run used normal child-process permissions. Existing harmless Zod/Rollup annotation warnings remain; build succeeded.

## 16. Security test results

New isolated tests cover tenant/client tampering, no employee membership from acceptance, role ceilings, wrong-email/expired/revoked/replaced/replayed/concurrent invitations, disabled issuer, duplicate/primary contacts, strict unknown fields, ownership references, publication and parent-thread visibility, per-grant switches, viewer denial, archive/revocation, CSRF/stale sessions, change transitions, task linking, DTO isolation, unsafe URLs, immutable recorded approval notes, concurrent approvals, preserved predecessor decisions, audit rollback and schema idempotency. These are regression tests, not penetration-test certification.

## 17. Browser test results

The full suite passed 148 cases. New scenarios use real compiled APIs and generated local MongoDB: create client/contact; invite and accept with verified external identity; share project; conceal draft/internal title; publish progress; client feedback and agency reply; change request review/task linkage; deliverable publication/approval/reload; revocation and employee-API denial. A second scenario covers accessible CRM forms, invitation, empty viewer portal and signout. Existing demo and Phase 4–6 flows also pass.

## 18. Accessibility results

37 automated axe scans across the full browser suite, including six new scans: CRM forms light/dark, portal deliverable light/dark, invitation and empty portal. New portal layouts also pass a 390px overflow check. Existing keyboard/theme/layout checks remain. These scans do not establish complete accessibility compliance.

## 19. Known limitations

- Files are HTTPS references/metadata only; provider ACLs control actual access. No uploads, object storage, malware scanner or signed-link claims.
- Mail follows commit without a durable outbox; authorized resend handles delivery failure. Capture does not imply Gmail delivery.
- Portal admins manage existing non-admin representatives only; agencies own invitations/admin grants.
- Publication is per client/project; no implicit broadcast. Progress is manually approved.
- Existing process-local limits remain; shared deployment rate-limit infrastructure is future work.
- No page-view analytics, real-time push, support ticketing, chat, billing or AI was added. Already delivered information cannot be erased remotely.
- Search is bounded literal regex; no unsupported performance benchmark or production certification is claimed.

## 20. Schema initialization requirements

Normal startup verifies Phase 7 readiness. Automatic provisioning is restricted to generated loopback test databases after the safety guard. The apply command requires `--apply --rotation-confirmed --schema-approved --approved-for=development|production`, matching the intended environment, and first checks Phase 5/6 readiness. The agent did not run apply. No Atlas drops, seeds, cleanup or business writes occurred.

## 21. Pending live rollout tasks

Rotation remains unconfirmed. The sanitized Atlas ping passed outside the network sandbox; the restricted attempt returned `DATABASE_DNS_FAILED`. Read-only metadata audit: Phase 5=false, Phase 6=false, Phase 7=false. This means the declared required sets are incomplete, not that every collection is absent. Private rotation and approved sequential schema installation remain required. Local verification is not live acceptance.

## 22. Exact manual verification steps

1. Privately rotate previously disclosed database/signing secrets and update the intended environment yourself. Do not paste values or private links into reports.
2. In backend, run `npm.cmd run build`, `npm.cmd run db:check`, and inspect `npm.cmd run schema:clients`. Review existing Phase 5/6 procedures.
3. Obtain intended-environment approval; initialize Phase 5, then Phase 6, then Phase 7 with documented acknowledgment flags. Never run test cleanup against Atlas.
4. Start existing dev scripts. Sign in as a controlled verified agency administrator and open a real workspace's Clients page.
5. Create an active client/contact and invite a controlled external email. Open only its private local capture file. Register/sign in, verify the matching email, reopen the invitation and explicitly accept.
6. Share one project with approved public text and selected switches. Check unrelated/unshared project and client IDs remain unavailable.
7. Save drafts, verify invisibility, then publish progress/milestones/deliverables. Submit feedback and a shared reply while preserving an internal-only note.
8. Submit/review/approve a change and link an authorized task. Confirm only the safe decision summary appears externally.
9. Approve a deliverable; create a replacement and confirm no inherited approval. Reload and sign in again to verify persistence.
10. Revoke grants/memberships and test later reads/writes plus a second controlled tenant/client. Record outcomes without private content or tokens.

## 23. Changed file inventory

19 created files; 23 modified files. No removed files, new dependencies or lockfile changes.

Created:

- [backend/scripts/generate-client-contract.mjs](../backend/scripts/generate-client-contract.mjs)
- [backend/src/commands/initialize-clients.ts](../backend/src/commands/initialize-clients.ts)
- [backend/src/modules/clients/client.models.ts](../backend/src/modules/clients/client.models.ts)
- [backend/src/modules/clients/client.routes.ts](../backend/src/modules/clients/client.routes.ts)
- [backend/src/modules/clients/client.schema.ts](../backend/src/modules/clients/client.schema.ts)
- [backend/src/modules/clients/client.service.ts](../backend/src/modules/clients/client.service.ts)
- [backend/tests/clients.test.ts](../backend/tests/clients.test.ts)
- [docs/architecture-decisions/012-client-portal-boundary.md](../docs/architecture-decisions/012-client-portal-boundary.md)
- [docs/phase-7-api-inventory.md](../docs/phase-7-api-inventory.md)
- [docs/phase-7-architecture.md](../docs/phase-7-architecture.md)
- [docs/phase-7-final-report.md](../docs/phase-7-final-report.md)
- [frontend/src/features/client-management/client-pages.tsx](../frontend/src/features/client-management/client-pages.tsx)
- [frontend/src/features/client-management/client-ui.tsx](../frontend/src/features/client-management/client-ui.tsx)
- [frontend/src/features/client-management/portal-continuation.ts](../frontend/src/features/client-management/portal-continuation.ts)
- [frontend/src/features/client-management/portal-pages.tsx](../frontend/src/features/client-management/portal-pages.tsx)
- [frontend/src/features/client-management/project-collaboration.tsx](../frontend/src/features/client-management/project-collaboration.tsx)
- [frontend/src/features/client-management/use-client.ts](../frontend/src/features/client-management/use-client.ts)
- [frontend/src/services/client-api.ts](../frontend/src/services/client-api.ts)
- [frontend/src/test/clients.test.tsx](../frontend/src/test/clients.test.tsx)

Modified:

- [AGENTS.md](../AGENTS.md)
- [README.md](../README.md)
- [backend/openapi.json](../backend/openapi.json)
- [backend/package.json](../backend/package.json)
- [backend/src/app.ts](../backend/src/app.ts)
- [backend/src/modules/auth/auth.routes.ts](../backend/src/modules/auth/auth.routes.ts)
- [backend/src/modules/health/health.service.ts](../backend/src/modules/health/health.service.ts)
- [backend/src/modules/work-management/work.service.ts](../backend/src/modules/work-management/work.service.ts)
- [backend/src/routes/index.ts](../backend/src/routes/index.ts)
- [backend/src/server.ts](../backend/src/server.ts)
- [backend/tests/auth-fixture.ts](../backend/tests/auth-fixture.ts)
- [backend/tests/unit/openapi.test.ts](../backend/tests/unit/openapi.test.ts)
- [docs/02-roles-and-permissions.md](../docs/02-roles-and-permissions.md)
- [docs/03-system-architecture.md](../docs/03-system-architecture.md)
- [docs/05-api-design.md](../docs/05-api-design.md)
- [docs/09-development-roadmap.md](../docs/09-development-roadmap.md)
- [frontend/e2e/auth.spec.ts](../frontend/e2e/auth.spec.ts)
- [frontend/src/features/auth/account-page.tsx](../frontend/src/features/auth/account-page.tsx)
- [frontend/src/features/auth/auth-page.tsx](../frontend/src/features/auth/auth-page.tsx)
- [frontend/src/features/auth/use-session.ts](../frontend/src/features/auth/use-session.ts)
- [frontend/src/features/workspaces/tenant-shell.tsx](../frontend/src/features/workspaces/tenant-shell.tsx)
- [frontend/src/routes/router.tsx](../frontend/src/routes/router.tsx)
- [frontend/src/styles/index.css](../frontend/src/styles/index.css)

## 24. Phase 8 readiness

Phase 8 is unstarted. Client/project boundaries are available for future authorized work; no support-ticket backend was added. Review/commit/push remains manual. Rotation, approved schemas and controlled live agency/client acceptance are the next rollout steps.
