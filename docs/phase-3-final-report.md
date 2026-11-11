# Phase 3 · Backend implementation and verification report

Phase 3 is complete. Root-level `backend/` runs independently of the existing frontend. All 25 requested acceptance criteria below pass. No Phase 4 functionality was started. Verification was performed during the November 6–7, 2026 session on Windows PowerShell, installed Node 24.15.0 and npm 11.12.1. Use a current patched supported LTS release for ongoing development/deployment.

## A. Features implemented

- Independent npm package/lockfile, Node ESM, strict TypeScript, source-only compiled build, tsx development watch, ESLint, Prettier and Vitest/Supertest configuration.
- Pure Zod environment validation for NODE_ENV/PORT/HOST/FRONTEND_ORIGIN/LOG_LEVEL, safe local defaults, explicit HTTPS production origins, optional native Node .env loading and field-only invalid-configuration diagnostics.
- Separate exported Express application factory and HTTP/process entrypoint. Isolated configuration, services, logger, lifecycle and clock are injectable.
- Versioned route registry; health/liveness/readiness module; deterministic, nonpersistent development example module demonstrating body/query/parameter schemas, controllers and services. Examples are absent in production.
- Canonical Phase 1 response envelopes, bounded UUID request IDs, centralized typed errors, malformed transport handling, generic unknown exceptions and safe 404 responses.
- Structured Pino/pino-http completion/error logs with method, route template, status, response time, error code and request correlation; sensitive bodies/headers/URLs and raw exception messages excluded.
- Helmet, exact allowlisted CORS without credentials, 16 KiB uncompressed JSON limit, no-store responses, process-local API IP throttling, safe proxy defaults and bounded HTTP receipt/header timeouts.
- Idempotent SIGINT/SIGTERM/fatal-failure handling, readiness/drain state, active-request completion, idle connection closure, 10-second shutdown deadline and real future resource-cleanup extension points.
- Static validated OpenAPI 3.0.3 for six implemented operations, 75 automated tests, architecture/run guides, 20 interview concepts and this exact implementation report.

Compatibility decisions: TypeScript 6.0.3 satisfies the installed typescript-eslint peer range; no force/legacy-peer-deps bypass was used. A patched minimatch override addresses lint-tool transitive advisories and passed the same checks. The latest brief defers the older roadmap's Redis/job selection. See the [architecture decisions and rationale](phase-3-backend-architecture.md#decisions-and-scope-reconciliation); historical planning documents remain intact.

## B. Exact files changed

Modified existing files (2):

```text
AGENTS.md
README.md
```

Created files (44: 41 backend files and 3 phase documents):

```text
backend/.env.example
backend/.gitignore
backend/.prettierrc.json
backend/eslint.config.js
backend/openapi.json
backend/package-lock.json
backend/package.json
backend/src/app.ts
backend/src/config/cors.ts
backend/src/config/env.ts
backend/src/lib/api-error.ts
backend/src/lib/async-handler.ts
backend/src/lib/logger.ts
backend/src/lib/server-lifecycle.ts
backend/src/middleware/error-handler.ts
backend/src/middleware/not-found.ts
backend/src/middleware/rate-limit.ts
backend/src/middleware/request-id.ts
backend/src/middleware/route-context.ts
backend/src/middleware/validate-request.ts
backend/src/modules/example/example.controller.ts
backend/src/modules/example/example.routes.ts
backend/src/modules/example/example.schema.ts
backend/src/modules/example/example.service.ts
backend/src/modules/health/health.controller.ts
backend/src/modules/health/health.routes.ts
backend/src/modules/health/health.service.ts
backend/src/routes/index.ts
backend/src/server.ts
backend/src/types/http.ts
backend/src/utils/response.ts
backend/tests/helpers.ts
backend/tests/integration/api.test.ts
backend/tests/integration/lifecycle.test.ts
backend/tests/integration/security-and-logging.test.ts
backend/tests/unit/env.test.ts
backend/tests/unit/openapi.test.ts
backend/tests/unit/process-and-errors.test.ts
backend/tsconfig.build.json
backend/tsconfig.json
backend/vitest.config.ts
docs/phase-3-backend-architecture.md
docs/phase-3-final-report.md
docs/phase-3-interview-notes.md
```

Total: 46 created/modified source-controlled paths; no deletions. Generated dependencies/dist files are ignored. No real .env, secret, frontend source/config/lockfile, existing Phase 1/2 document, ADR or deployment file was changed. Root .gitignore already covered general artifacts; backend-specific ignore rules additionally cover coverage and local environments. No commit or deployment was performed.

## C. Backend architecture and lifecycle

`app.ts` composes global middleware and the `/api/v1` registry without reading global env or listening. `server.ts` validates configuration, creates collaborators, starts the compiled HTTP listener and registers process lifecycle handlers. Routes own HTTP wiring; schemas own allowed input; controllers map validated context into service calls and response DTOs; services compute independently of Express. The central error handler normalizes operational, parser and unexpected failures.

Actual request order: client → request ID → logging → Helmet/no-store → CORS → API limiter → drain gate → bounded JSON → versioned router → route context/schema validation → controller → service → success envelope. Errors flow to the central handler; completion logging records the outcome. Parsed values live in `res.locals.validated`, respecting Express 5's read-only query getter. Native Express 5 async rejection handling is used; the optional async adapter is separately tested.

Success is `{data,meta:{requestId}}`; failure is `{error:{code,message,details},meta:{requestId}}`. Well-formed schema failures use 422; malformed JSON uses 400. These preserve Phase 1 contracts instead of adopting the illustrative Phase 3 sample's incompatible envelope.

## D. Operational API endpoints

| Method / endpoint | Result / scope |
|---|---|
| GET /api/v1/health | 200 readiness summary, safe service/version/phase/timestamp; 503 when unavailable |
| GET /api/v1/health/live | 200 process liveness, including drain state before listener closure |
| GET /api/v1/health/ready | 200 ready; 503 unready/draining |
| GET /api/v1/example?limit=2 | Development/test catalog, integer limit 1–3, persisted=false |
| GET /api/v1/example/:code | Development/test enum code: validation, errors, observability |
| POST /api/v1/example/validate | Development/test strict JSON label/count/category validation and pure result |

Production examples return 404. Health does not claim database/provider connectivity. Express also supplies HEAD for GET endpoints; allowed CORS preflight returns 204. No business/auth route is advertised by [OpenAPI](../backend/openapi.json), and Swagger UI is not publicly served.

## E. Security configuration and limits

Helmet headers include nosniff, frame/referrer/CSP defaults and production-only HSTS. Trusted origins are exact validated origins, credentials are disabled, and an untrusted Origin returns a safe 403. Non-browser/no-Origin clients remain allowed. Request bodies cannot exceed 16 KiB; compressed input and unsupported representations fail safely. API throttling defaults to 120 requests/minute/IP, exempts health/preflight, returns canonical 429 plus standard headers, and uses IPv6-aware keys. `trust proxy=false` prevents client-provided forwarding headers from becoming limit identities.

IDs are bounded UUID-shaped values or freshly generated UUIDs. JSON logs use route templates rather than user-controlled paths/query strings. Errors never expose raw messages or stacks to clients, including development. These are infrastructure controls, not authentication, authorization, tenant isolation or CSRF protection. Memory rate stores reset on restart and do not coordinate multiple replicas. Future proxy/credential/rate policies must be reviewed against actual hosting and sessions.

## F. Executed verification

Final results after correcting type-only imports and the OpenAPI parser union narrowing:

| Directory / command or check | Actual result |
|---|---|
| backend: npm.cmd install | Passed; runtime/dev dependencies installed and lockfile generated; no peer override bypass |
| backend: npm.cmd run format | Passed; source, tests, spec and config formatted |
| backend: npm.cmd run typecheck | Passed, strict source and test types |
| backend: npm.cmd run lint | Passed, zero warnings |
| backend: npm.cmd run test | Passed: 6 files, 75 tests; final rerun 11.67 seconds |
| backend: npm.cmd run build | Passed, source-only ESM output in dist |
| backend: npm.cmd run format:check | Passed, all matched files |
| Compiled development entrypoint, real temporary TCP port | Passed all HTTP/log checks described below; process exited after cleanup |
| Compiled production entrypoint, explicit --production flag | Passed health 200, examples 404, HSTS; flag overrides development NODE_ENV |
| Compiled invalid production config | Passed: exit code 1, FRONTEND_ORIGIN field identified, rejected marker value absent from diagnostics |
| frontend: npm.cmd run test | Passed: 2 files, 13 tests |
| frontend: npm.cmd run build | Passed TypeScript and Vite build, 2282 modules; two non-fatal dependency-comment annotation warnings |
| git diff --check | Passed; Git emitted only normal LF→CRLF checkout notices |
| Existing frontend / Phase 1 / Phase 2 / ADR diffs | No tracked changes |
| Documentation/inventory checks | Passed: all 46 changed paths appear in this report, 30 local links resolve, fenced code blocks balance, no real backend .env exists |

The compiled smoke harness launched `node --env-file-if-exists=.env dist/server.js` as a child, selected a temporary available loopback port, waited for real readiness, issued real fetch requests, asserted results and stopped every child. Checks: health 200 and safe envelope; valid POST 200/persisted=false; invalid POST 422/VALIDATION_FAILED; missing route 404/NOT_FOUND; malformed JSON 400/MALFORMED_JSON; accepted request ID propagation; nosniff; exact allowed-origin header; rejected-origin 403 with no allow-origin header; preflight 204; correlated JSON completion log with route and duration. Separate compiled processes verified production route exclusion and invalid-env fail-fast behavior. The inline harness was a verification action, not a committed production script.

Windows child termination in that smoke check is not claimed as an end-to-end OS signal drain test. Real ephemeral-listener tests verify active-request completion, shared shutdown promises, deadlines/disconnection, busy ports and cleanup-hook failure; isolated process-emitter tests verify signal/fatal behavior and handler disposal without terminating Vitest. Supertest does not bind the configured production port. No database or external provider is required by tests.

Tests additionally cover missing fields, invalid types/ranges/unknown fields, query/parameter rejection, malformed percent encoding, body cap/media/encoding failures, readiness/drain behavior, HEAD, UUID uniqueness/replacement/propagation, log privacy, rejected async services, generic production 500s, health-limit exemptions, rate-store isolation and spoofed forwarding headers. OpenAPI is structurally/reference-validated without external resolution and checked against the six successful implemented operations/envelopes. No coverage percentage, load benchmark or security certification is claimed.

Dependency advisory limitation: installation after the patched minimatch override reported **0 vulnerabilities**. After adding the development-only OpenAPI validator, the final standalone `npm.cmd audit --audit-level=moderate` refresh failed with `getaddrinfo ENOTFOUND registry.npmjs.org` and exit 1. This is an unavailable refresh, not a clean final audit result; rerun when registry DNS/network is available. The implementation gates above do not depend on that network service. No Playwright rerun was performed in Phase 3; the unchanged frontend's Vitest tests and production build were rerun.

## G. Exact local PowerShell commands

```powershell
Set-Location C:\FLOWWORKAI\backend
npm.cmd install
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
npm.cmd run dev
```

In a second terminal:

```powershell
Invoke-RestMethod http://localhost:5000/api/v1/health
$body = @{ label = 'Useful example'; count = 2 } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri http://localhost:5000/api/v1/example/validate `
  -ContentType 'application/json' -Body $body
```

After stopping development with Ctrl+C, run verification/build in backend:

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run test
npm.cmd run build
npm.cmd run format:check
```

For a local compiled production-mode check, set a clearly illustrative HTTPS browser origin before start. This does not create TLS or deploy anything:

```powershell
$env:FRONTEND_ORIGIN = 'https://console.example.com'
npm.cmd start
```

Examples are disabled in this mode; use health to verify. Production needs actual configured origins and reviewed hosting. Remove the temporary FRONTEND_ORIGIN from the shell afterwards if returning to local defaults. `npm.cmd` avoids PowerShell's restricted npm.ps1 execution path. Frontend remains a separate terminal/package:

```powershell
Set-Location C:\FLOWWORKAI\frontend
npm.cmd run dev
```

## H. Frontend preservation

No frontend code, dependency, lockfile, fixture, store, hook or route was edited. The original working demo remains in memory, without fake backend authentication or replacement of its mock repository. Git diffs show no tracked frontend changes, its 13 Vitest tests pass, and its production build succeeds. Existing Phase 1/2 documents and ADRs also have no tracked modifications. Only the authorized root README/AGENTS summaries changed alongside new backend/Phase 3 files. Browser-console/PowerShell health recipes in the architecture guide provide connection readiness without changing product flows.

## I. Interview learning

[Interview notes](phase-3-interview-notes.md) explain all 20 requested topics with small examples: Node/runtime/event loop/non-blocking I/O; Express/middleware/REST/methods/statuses; controllers/services/injection/Zod/errors; CORS/Helmet/rates/IDs; React communication/app separation/shutdown/modular monolith. Suggested order follows those groups, then traces the real validation request through source and integration tests. Distinguish implemented infrastructure from later persistence/security guarantees when explaining this project.

## J. Known limitations

- No MongoDB client/Mongoose models, persistent business data, signup/login/JWT/password hashing/sessions, workspace/project/task/ticket CRUD or real tenant authorization.
- No Socket.IO, worker/Redis/queue integration, AI provider/RAG, uploads/email, payments/subscriptions or deployed production infrastructure.
- Readiness is HTTP lifecycle only. Future dependencies require actual startup/readiness/cleanup hooks and their own network/execution deadlines.
- CORS is not access control; process-local throttling and default proxy policy need deliberate changes before replicated/proxied production use. Cookie/CSRF/session policy belongs to future authorized work.
- No load, penetration, hosted TLS, backups, distributed limits or production-readiness certification was attempted. Use a patched LTS runtime; the installed host version was tested, not upgraded.
- The final advisory refresh was unavailable due to registry DNS, as recorded above.

## K. Acceptance criteria

| # | Requested criterion | Status / evidence |
|---|---|---|
| 1 | Root-level backend exists | Passed: isolated backend package |
| 2 | Node.js and TypeScript | Passed: ESM strict TS, installed supported-major Node |
| 3 | Express starts | Passed: actual compiled development/production listeners |
| 4 | Separate app/server | Passed: import-safe factory versus process entrypoint |
| 5 | Validated environment | Passed: Zod unit tests and compiled invalid-env exit |
| 6 | /api/v1 routes | Passed: registry and version rejection tests |
| 7 | Health works | Passed: safe DTO, liveness/readiness tests and real HTTP |
| 8 | Example validation works | Passed: real valid/invalid POSTs |
| 9 | Controllers/services separated | Passed: HTTP adapter versus typed computation modules |
| 10 | Zod validation | Passed: body/query/params success/failure cases |
| 11 | Centralized errors | Passed: parser, operational, async and unknown paths |
| 12 | Safe 404 | Passed: tests and compiled smoke |
| 13 | Request IDs | Passed: uniqueness, replacement and header/body/log propagation |
| 14 | Structured logging | Passed: captured JSON privacy/correlation tests and compiled log |
| 15 | Helmet | Passed: security-header and production-HSTS checks |
| 16 | Safe CORS | Passed: exact allow/reject/preflight tests and compiled HTTP |
| 17 | Rate limiting | Passed: 429 envelope/headers, exemptions, isolation, spoof resistance |
| 18 | Graceful shutdown | Passed: real ephemeral drain/deadline/hooks and isolated signal tests |
| 19 | OpenAPI | Passed: static 3.0.3 and parser/reference/operation checks |
| 20 | Automated tests | Passed: 75 backend tests |
| 21 | Production build | Passed: tsc emitted ESM |
| 22 | Startup verified | Passed: compiled live HTTP and invalid-config checks |
| 23 | Frontend intact | Passed: no tracked edits, 13 tests and build |
| 24 | Updated documentation | Passed: README, AGENTS, architecture, interview notes and this report |
| 25 | No Phase 4 added | Passed: no database/auth/business integration/dependencies |

## L. Phase 4 prerequisites only

Await explicit authorization. Prepare an isolated transactional MongoDB environment and schema/index/migration strategy; review the existing opaque session/password/CSRF and tenant policy; arrange secure email delivery/test doubles; decide actual hosting/proxy/cookie origins; design dependency readiness/cleanup and auth-specific limits. Confirm contracts and security acceptance tests before connecting frontend identity/business flows. Phase 4 has not been implemented or started.
