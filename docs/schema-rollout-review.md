# Phase 5-7 schema rollout review

Reviewed November 12, 2026. Live rollout is pending; this document is not approval.

## Confirmed cause and target

The application connects to Atlas, then fails closed at `TENANT_SCHEMA_NOT_READY` before opening HTTP. The frontend therefore cannot reach the API. This is a missing-schema rollout, not evidence of an authentication or DNS defect.

Read-only Atlas inspection confirmed `NODE_ENV=development`, exact database **`test`**, an existing database with auth collections, configured DNS and successful connectivity. The database name is independent of NODE_ENV: this is the owner's existing Atlas database, not the generated local test fixture. Do not substitute a new database. Explicitly confirm this exact target before applying.

All 11 declared auth indexes are present. All 17 Phase 5-7 collections are absent. There are no existing records or indexes in those missing collections to conflict with installation. No private records, credentials, connection hostnames or mail contents were printed. No Atlas writes were performed.

## Exact additive plan

The machine-readable [schema plan](schema-initialization-plan.json) contains every declared index key, direction and option, plus observed presence. It was generated from the compiled repository schemas and live read-only metadata. Apply in this order:

| Phase | Create collection | Declared indexes |
|---|---|---:|
| 5 | organizations | 2 |
| 5 | workspaces | 3 |
| 5 | organizationMemberships | 3 |
| 5 | workspaceMemberships | 3 |
| 5 | invitations | 5 |
| 6 | projects | 4 |
| 6 | projectMemberships | 2 |
| 6 | tasks | 4 |
| 6 | taskComments | 2 |
| 6 | activityEvents | 2 |
| 7 | clients | 2 |
| 7 | clientContacts | 3 |
| 7 | portalMemberships | 2 |
| 7 | portalInvitations | 3 |
| 7 | clientProjectGrants | 2 |
| 7 | clientResources | 6 |
| 7 | clientAuditEvents | 1 |

Total: 17 collections, 49 declared indexes, plus MongoDB's automatic `_id` index for each new collection. The existing auth collections/indexes need no additions.

The three ensure functions use `createCollection` and `createIndexes`, without `syncIndexes`, drops, deletes or data migrations. Existing identical indexes are retained, making retries additive. A conflicting index causes failure rather than replacement. Installation is not one atomic transaction: retry after an interrupted run must first recheck metadata. The invitation `purgeAt` TTL index expires future eligible invitation records; its collection is currently absent, so no existing records are exposed to a newly installed TTL index. Reaudit if database state changes before approval.

Normal backend startup also calls the additive auth initializer, so starting it remains within the live-write approval gate even though the existing auth schema is ready. No users, sessions or tokens will be seeded, edited or deleted by these schema commands.

## Local correction

`initialize-tenants.ts` previously accepted the rotation flag alone. It now matches the Phase 6-7 command contract: plan by default without connecting; application requires `--apply`, `--rotation-confirmed`, `--schema-approved`, and `--approved-for` matching development or production. Test environment application is rejected. DNS setup still precedes database connection. Startup readiness and authentication remain unchanged.

Entrypoint regression tests cover a read-only plan with the legacy flag, incomplete approvals, wrong-environment approval and DNS-before-connection ordering. README startup instructions now require all three schema phases instead of suggesting the tenant command alone is sufficient. Historical phase reports are preserved.

## Private rotation and approval prerequisites

The owner explicitly confirmed that MongoDB password and JWT signing-secret rotation are **still pending**. Privately rotate the existing database user's password using the existing Atlas account, then update only the credential portion of `MONGODB_URI` in `backend/.env`, percent-encoding reserved characters in the password. Keep the same database target and other settings. Replace only `JWT_SECRET` with a cryptographically generated random secret encoded as 64-128 hexadecimal characters, as required by the existing backend validator. Do not paste either value into chat, reports or logs. Restart processes after rotation; previously signed access cookies will no longer validate. Do not delete session records as part of rotation.

After both rotations, provide status only and explicitly approve the existing **development / `test`** target and the exact plan above, including normal additive auth initialization during startup. Approval does not cover Atlas test-account creation or business-data writes. Those tests use isolated generated local fixtures.

Only after approval, rebuild, repeat the read-only connectivity/metadata checks and run these existing commands from `backend/`, in order:

```powershell
npm.cmd run build
npm.cmd run db:check
npm.cmd run schema:tenants -- --apply --rotation-confirmed --schema-approved --approved-for=development
npm.cmd run schema:work -- --apply --rotation-confirmed --schema-approved --approved-for=development
npm.cmd run schema:clients -- --apply --rotation-confirmed --schema-approved --approved-for=development
npm.cmd run dev
```

Stop on any command failure. Do not assert rotation through flags until actually completed. Confirm both `Database connected` and `HTTP server listening`, then read `/api/v1/health/ready`. Live startup and the owner's signup/login remain unverified until that rollout. No Phase 8 work is included.

## Verification

Backend typecheck, lint, build and formatting checks passed. Backend tests: **259 passed across 15 files**, including six added entrypoint safety cases. The first run, concurrent with frontend checks, had a Phase 6 timeout followed by a dependent conflict; the sequential full rerun passed without changing application code or weakening timeouts.

Frontend typecheck, lint, build and **62 tests across seven files** passed. Build reports existing dependency annotation warnings from Zod, without build failure. Playwright: **148 passed (9.4 minutes), exit code 0**, including isolated real-backend authentication and Phase 5-7 browser flows. The first browser invocation timed out starting Vite before tests; the retry completed successfully.

`npm.cmd run db:check` returned `connected:true, pingSucceeded:true`. `npm.cmd run schema:tenants` returned `mode:plan, writes:false` and the expected five collections without connecting. Read-only Atlas schema compatibility was inspected separately as recorded above.

Local authentication and Phase 5-7 tests include signup, captured verification, existing fixture account login, refresh/logout, CORS/CSRF rejection, organizations/workspaces, project/task persistence, board ordering, client invitations/sharing, tenant isolation and RBAC. Live schema initialization, normal Atlas-backed development startup and the owner's account login have intentionally not been executed. Those remain pending rotation and explicit approval; passing local tests does not establish live acceptance.

## Files changed

- `backend/src/commands/initialize-tenants.ts`: read-only default and explicit environment/application approval gates.
- `backend/tests/unit/dns-startup.test.ts`: six approval and startup-order regression cases.
- `README.md`: current schema rollout prerequisites and links.
- `docs/schema-initialization-plan.json`: exact reviewed collection/index metadata.
- `docs/schema-rollout-review.md`: this report and pending rollout procedure.

No frontend source, auth implementation, database models, private `.env`, credential values or historical phase reports were changed.
