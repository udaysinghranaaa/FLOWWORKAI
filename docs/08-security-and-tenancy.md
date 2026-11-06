# 08 · Security and multi-tenancy

Status: required design controls and future release tests. No control has been implemented or penetration-tested. Sources support design guidance, not a security certification.

## Tenant and authorization policy

Shared MongoDB collections use required immutable workspaceId on every tenant entity. Workspace IDs originate in explicit routes, are validated and bound to current active membership. Never trust an “active workspace” cookie/body field as authority. Resolve global identity first, tenant second, then resource/parent/action. Cross-tenant lookups return concealed 404; same-workspace relationship violations return generic 422. No wildcard/admin tenant bypass in ordinary repositories.

Document 02 is the policy source: Owner/Admin internal workspace access, Manager/Member project grants, Client matching clientId plus explicit grant plus published ancestors/children. Assigned tickets are a narrowly bounded exception, not implicit project access. Server authorization applies to routes, batch operations, aggregations, serializers, sockets, jobs, exports, files and AI retrieval. Separate test fixtures must contain two workspaces and two clients within one workspace; testing tenant isolation alone misses same-tenant client leakage.

## Threat model

Assets: credentials/sessions, tenant business content, client-private records, binaries, AI context, entitlements and audit evidence. Actors: anonymous attacker, malicious client, compromised staff, removed member, malicious document author, compromised provider and privileged platform operator. Browser, upload content, model output, webhooks and job payloads cross trust boundaries.

| Attack / concrete scenario | Preventive/detective control | Required negative test / residual risk |
|---|---|---|
| Staff substitutes another workspace task ID | Tenant-filtered repository and related-parent checks | Two-tenant GET/PATCH/DELETE/aggregate/file tests return concealed 404; DB credentials still have broad trust |
| Client A requests Client B's ticket in same workspace | Server-derived clientId, public DTO and client predicate | Lists/detail/messages/notifications/downloads deny; no existence disclosure |
| Member PATCHes role or publication flag | Strict Zod allowlist plus per-field capability | Mass-assignment request denied; hidden buttons are insufficient |
| Manager edits unassigned project | Require active manager grant | Workspace role alone returns 404/403 per visibility |
| Last two owners demote concurrently | Shared workspace guard record in transaction | Concurrent test leaves ≥1 owner, verifies counter consistency |
| Removed user keeps websocket connected | Live membership check, disconnect signal, per-recipient emit checks | Existing socket receives no further protected payload; minimal in-flight hint risk remains |
| Cross-tenant foreign reference on create | Validate all related IDs with workspace and parent | Foreign assignee/milestone/attachment causes 422, no orphan record |
| Stale vector index returns revoked source | Strict prefilter plus live source/generation ACL checks before prompt and response | Revoke mid-answer, ensure refusal/regeneration; already-sent provider context cannot be recalled |
| Uploaded PDF instructs model to reveal secrets | Treat retrieved text as untrusted data, no secrets/tools in context, read-only adapter | Adversarial corpus cannot expand ACL or call tools; prompt defenses alone are not proof of safety |
| Signed URL shared after member removal | Fresh auth before issuance, ≤60 s expiry, proxy for highest sensitivity | Unauthorized issuance fails; issued URL remains bearer access until expiry |
| Forged or replayed billing webhook | Raw-body signature/timestamp check, durable event uniqueness, provider object reconciliation | Invalid signatures do nothing; duplicates/out-of-order events do not grant extra entitlement |
| Job initiated by now-removed manager | Reload live initiator policy and current object generation before action | Delayed export/ingestion canceled, no storage URL exposed |
| Cache serves prior tenant | Keys include principal/tenant/access revision, no shared private response cache | Switch/logout and membership-revision tests clear data; browser extensions remain outside control |
| Password/reset enumeration | Generic messages, bounded hashing/limits, single-use tokens | Equivalent public response shapes; timing reviewed with realistic measurement |
| Operator abuses production access | MFA, least privilege, break-glass case, time limit, external audit | Quarterly access review and sampled evidence; infrastructure compromise remains material risk |

## Session and password design

Password hashing uses Argon2id with a vetted maintained Node implementation; initial candidate baseline 19 MiB memory, 2 iterations, parallelism 1, tuned upward against production hardware under bounded concurrent load. Store algorithm parameters in hash; rehash on login when policy changes. No reversible passwords; pepper optional only if managed/rotatable separately. Password policy 12–128 characters, permit spaces/paste/password managers, reject known-compromised/common passwords through a privacy-preserving method before launch. Do not log credentials or silently truncate multibyte inputs. See [OWASP password storage guidance](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html).

Use opaque cryptographically random access/refresh values with ≥256 bits entropy, stored as cryptographic hashes server-side. Access lifetime candidate 15 min; refresh idle 7 days/absolute 30 days. Rotate both on refresh atomically, record consumed refresh hashes and revoke family on replay. Authenticate via active session record on every request; short access lifetime does not replace revocation checks. Session token hashes must be uniquely indexed. Rate-limit rotation and cap token history by revoking excessive families. Tabs coordinate refresh to reduce false replay logouts; fail closed on ambiguity.

Production cookies: `__Host-fw_access` and `__Host-fw_refresh`, HttpOnly, Secure, SameSite=Lax, Path=/, no Domain. Host prefix requires Path=/, so refresh cookie reaches other paths; only refresh handler consumes it and logging always redacts cookies. Access Max-Age aligns with expiry; refresh Max-Age cannot extend absolute lifetime. Separate approved local development cookie configuration must never weaken production requirements. Reauth is a server session timestamp, not a browser boolean. Password reset/global account disable revokes all families; workspace removal revokes only that tenant authorization. Logout clears matching cookie paths/attributes and revokes family.

OWASP recommends explicit session protections and treating SameSite as defense in depth, rather than the entire CSRF control ([session guidance](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)). Use a synchronizer CSRF token bound to the pre-session/session, exposed through same-origin bootstrap response and sent in a custom header for all unsafe browser requests. Rotate it on login, refresh and logout boundaries. Validate Origin and, where available, Fetch Metadata; reject unapproved origins, disallow state-changing GET. Token comparison uses constant-time primitives. XSS can defeat CSRF, so sanitize output, constrain scripts with CSP and never render model text as raw HTML.

Email verification/reset tokens are separate random hashed single-use values, consumed atomically with account update. Candidate reset 15 min, verification 1 h. Return generic forgot/signup responses. Email-change and MFA features are future scope; commercial risk review may make MFA a launch blocker for high-sensitivity customers rather than pretending password-only meets every buyer's needs.

## HTTP, validation and secrets

- Same-origin hosting preferred. Development CORS uses an exact configured origin allowlist, credentials true, explicit methods/headers; no wildcard/reflection with cookies. WebSocket Origin is checked separately.
- Express trusts only configured edge proxy hops so IP-based limits cannot be spoofed. Enforce TLS, HSTS after deployment validation, CSP, nosniff, referrer policy and frame-ancestor restrictions.
- Bounded JSON and raw webhook bodies, request/header/time limits, safe query parsers, Zod on body/path/query, reject unknown fields/operators/prototype pollution and invalid sort keys. Error payloads contain safe field paths only.
- Shared Redis limits and local concurrency circuit breakers prevent auth/AI floods. If shared enforcement fails, high-risk endpoints fail closed or use explicitly bounded emergency local limits approved in operations policy.
- Environment schema validates required variables at boot. Secrets from managed injection/store, separate environments and least-privilege database/bucket/LLM/provider credentials; no keys in Vite-prefixed variables, browser bundles, documents or Git. Rotate on exposure. CI uses scoped short-lived identity where supported.
- Dependency versions/lockfile, vulnerability scanning, secret scanning and container scanning begin during authorized implementation; no dependencies installed in Phase 1.

## Files and storage

Bucket is private with public ACLs blocked. Signed upload intent binds server-generated workspace key, allowed size/checksum/type and short expiry; enforce actual object attributes at finalize even if storage does not support every policy condition. Metadata record authorizes nothing until scan status is clean. Malware scanner runs with limited resource/network permissions; extraction has file/page/time/token limits and no macros/scripts/remote URL fetching. Unsupported archives/office formats are rejected initially. Preserve filename only as sanitized metadata, never filesystem/object path input.

Download requires current parent and visibility policy, clean status, attachment disposition and 60-second maximum bearer URL; no URL in audit/analytics logs. Revocation marks metadata inaccessible immediately; storage deletion is asynchronous with retry/orphan reconciliation. For strict immediate revocation requirements, proxy and authorize each download instead of promising signed-URL revocability. Exports use the same private storage and short-authorized download lifecycle; job results do not contain public links.

## AI boundaries and tenant-safe RAG

1. Confirm current membership/entitlement and atomically reserve a bounded worst-case usage amount before embedding/generation.
2. Resolve allowed active documents from workspace-internal scope and granted projects. Client AI is disabled; user-selected IDs narrow this set, never expand it. Cache authorization only with access revision and bounded lifecycle; live check remains authoritative.
3. Embed only the bounded question through server-side adapter. No API keys or privileged tools in prompts.
4. Apply mandatory Vector Search prefilter on workspaceId plus server-derived authorized document IDs, active/generation constraints and configured index fields. If authorized set is too large, safely partition/limit or refuse, never drop the filter.
5. Recheck each chunk's document status, generation, workspace and current actor ACL in MongoDB before building minimal context; reject stale hits. Include source IDs/offsets, not arbitrary fetched URLs.
6. Model instructions label source text untrusted. Ignore document requests to change system rules; this is an aid, not the authorization boundary. No network browsing or write tools in launch assistant.
7. Validate response schema, citation subset, lengths and HTML/URL safety. Insufficient evidence produces a refusal. Citation presence does not prove semantic truth; maintain a human-reviewed evaluation corpus.
8. Reauthorize final sources/initiator before delivering response. If a source changed, discard and regenerate within budget or return safe refusal. Track sanitized usage/model/index generation, no raw content by default.
9. Reconcile reservation with known provider usage. Timeouts may incur charges; retain conservative unknown usage until reconciliation rather than allowing repeated quota evasion.

Tenant ACL revocation is immediate in source metadata even though vector indexing is eventual. Disable source read immediately, invalidate caches, revoke generation, queue physical purge. Avoid shared prompt/result caches across workspaces; no model training permission or zero-retention assumption without a provider contract. Provider processing region, retention, abuse logging and subprocessors require review before customer content is sent. Prompt injection and hallucination cannot be eliminated by a single prompt or schema check.

## Audit, logging and lifecycle

Structured logs allowlist metadata and redact all cookies, auth headers, tokens, raw webhook payloads, prompts, document text and signed URLs. Audit role changes, failed policy actions at a bounded rate, publication, file export, ownership transfer, subscription operations and deletion. Append-only application access plus restricted external retention provides stronger integrity than a mutable collection alone. Security logging must not become a cross-tenant data export path. Tenant audit API is Owner/Admin-only; platform incidents use a separate restricted sink.

Retention proposals: notification 90 days; ordinary activity/audit 12 months; closed tickets 24 months; soft-delete recovery 30 days; abandoned upload 24 h; quarantined file 7 days; financial records candidate 7 years pending jurisdiction review. Actual customer contracts/holds may alter these before launch. Deleted workspace becomes inaccessible immediately, purges online data after recovery window, deletes vectors/binaries/cache keys and records minimal completion evidence. Backups remain isolated and age out; restore replays deletion/revocation manifests before traffic resumes. A hold suspends applicable purge with reason/access controls, never quietly keeps all data indefinitely.

Atlas backups require explicit enabled tier, encryption and restore permissions. Candidate recovery objectives RPO 24 h/RTO 8 h depend on configured backup frequency and drills. Restore to an isolated environment; verify tenant counts/checksums/ownership/subscriptions and expired session revocation before cutover. Single-tenant recovery from shared backups is an operational procedure requiring selective extraction and revalidation, not a one-click claim. Export/delete workflows need region/legal review before external use.

## Security test and release requirements

Vitest: capability predicates, allowed fields, serialization, expiry, quota math and generation checks. Supertest with disposable replica-set database: all role/resource combinations; two workspaces and two clients; refresh replay and races; last-owner races; transaction rollback/outbox; IDOR; forged signatures; duplicate/out-of-order webhooks; upload finalize tampering. Socket integration: unauthorized joins, revoked session/membership, reconnect and internal-data suppression. AI integration/evals: malicious source corpus, foreign chunks, removed grants mid-flight, invalid citations, provider failures and accounting reconciliation. Playwright: real cookie/CSRF behavior, browser origins, Client versus staff DOM/network payloads, safe download flow and workspace switching.

CI must fail on secret leaks, failing boundary tests and unresolved high/critical dependency findings. Pre-pilot external security review scope includes auth, tenant isolation, files and AI. No compliance badges, “fully secure” claims or completed-security assertions without evidence. Incident runbook must identify detection owner, credential revocation, tenant containment, evidence preservation, notification decision process and recovery validation before production launch.
