# 05 · REST API contracts

Status: historical Phase 1 target contract. Infrastructure, authentication and Phase 5 company/workspace/membership/invitation endpoints are implemented. OpenAPI 0.5 and the Phase 5 addendum below govern operational routes; later business tables remain planned.

Phase 4 addendum: the explicit latest brief chooses JWT access cookies with live database session checks, `/auth/register` with `name`, and `/auth/me`. Historical `/auth/signup`, `displayName` and `/users/me` are not operational aliases. Generic registration/recovery responses, safe envelopes and pre-auth CSRF intent remain. [ADR 009](architecture-decisions/009-jwt-cookie-authentication.md) records the changes; live Atlas verification remains blocked as documented in the current report.

## Transport and common contracts

Production browser/API share one origin. JSON requests use `Content-Type: application/json`, cookies and `X-CSRF-Token` on unsafe methods, including auth endpoints using a pre-auth CSRF bootstrap. `/auth/csrf` returns a session/pre-session-bound token; never put credentials in query strings. Payment webhook uses raw bytes and verified signature instead of cookie/CSRF authentication. All IDs are validated, but valid format does not imply access.

Success: `{"data":{...},"meta":{"requestId":"req_123"}}`. Lists use data arrays with `meta.page:{nextCursor,hasMore,limit}`. 204 has no body. Error: `{"error":{"code":"VALIDATION_FAILED","message":"Check the highlighted fields","details":[{"path":"title","message":"Required"}]},"meta":{"requestId":"req_123"}}`. Never expose password hashes, token hashes, storage keys, stack traces or internal/client-ineligible fields. All Date values are ISO-8601 UTC strings. DTO includes id, version and timestamps where relevant, never raw Mongoose serialization.

Pagination: `limit` default 25, maximum 100; opaque signed cursor binds workspace, principal/access revision, sort and filter; invalid/stale cursor returns 400/409 requiring restart. Default sort `-createdAt,-id`; comments/messages chronological. Alternative allowlisted sorts: tasks dueAt/status/rank, clients name, tickets updatedAt, projects name. Stable `_id` tiebreaker required. Board fetch is paginated per status, never all tasks unbounded. Search `q` trimmed 2–120 chars, escaped bounded literal search initially; no arbitrary regex/query DSL. Filters are named fields, date ranges valid ISO and capped ranges. Reject unknown query keys.

Every table row inherits **E** errors: 400 malformed syntax/cursor, 401 unauthenticated or expired session, 403 visible resource but capability denied, 404 nonexistent or concealed resource, 422 schema/relationship validation, 429 limit exceeded, 500 unexpected failure, 503 unavailable dependency. Public endpoints omit role-dependent E errors where inapplicable. Mutations also inherit **M**: 409 stale version/duplicate/idempotency conflict. Expired invite/action token adds 410. No stack or resource-existence leak in any error. Tables give endpoint-specific validation and domain errors beyond E/M.

Validation abbreviations: **ID** canonical ID plus same-tenant/parent checks; **V** `version` positive integer where specified on versioned domain mutations (DELETE uses `If-Match: "vN"`); **N** trimmed name 1–120; **T** title 1–240; **B** body ≤20,000; **D** valid ISO date; **P** pagination rules above. Mutation fields are exact allowlists, all other keys rejected. Missing precondition on versioned mutation returns 428; mismatch returns 409 `VERSION_CONFLICT`. Session revocation, invitation revocation and notification read-state changes are idempotent state transitions without a version precondition.

## Identity and workspaces

| Method and URL | Permission | Request and validation | Success DTO/status | Additional errors |
|---|---|---|---|---|
| GET /auth/csrf | Public/session | No body; same-origin bootstrap | 200 `{csrfToken}` + pre-session cookie if needed | 429 |
| POST /auth/signup | Public + pre-auth CSRF | `{email,password,displayName}` email ≤254, password 12–128 chars without silent truncation, N | 202 generic verification message; sends single-use email token | 422 password policy; email existence not disclosed |
| POST /auth/verify-email | Public + CSRF | `{token}` bounded opaque token | 200 verified result | 410 expired/consumed, 400 invalid |
| POST /auth/login | Public + CSRF | `{email,password}` bounded, generic failure | 200 `{user,sessionExpiresAt}` + HttpOnly cookies | 401 invalid credentials, 403 verified email required after valid credentials |
| POST /auth/refresh | Refresh cookie + CSRF | No body; atomic rotation | 200 `{sessionExpiresAt}` + new cookies | 401 expired/replayed/revoked family |
| POST /auth/logout | Session + CSRF | No body; idempotent revoke | 204 + clear cookies | Expired cookie still cleared |
| POST /auth/forgot-password | Public + CSRF | `{email}` | 202 generic message | No account enumeration |
| POST /auth/reset-password | Public + CSRF | `{token,password}` same policy | 204, revoke all families | 410 expired/consumed, 400 invalid |
| GET /users/me | Authenticated | No body | 200 own user safe DTO | E |
| PATCH /users/me | Self | `{displayName,version}` N/V; email change excluded MVP | 200 own user DTO | M |
| GET /users/me/sessions | Self | P | 200 own session summaries, no hashes | E |
| DELETE /users/me/sessions/:sessionId | Self | ID; never another user's session | 204 family revoked | 404 |
| POST /users/me/reauth | Self + CSRF | `{password}`; rate limited | 204 marks session recently authenticated for 10 min | 401 wrong password |
| GET /workspaces | Authenticated | P | 200 active membership workspace summaries | E |
| POST /workspaces | Verified user | `{name,slug,creationKey}` N, slug rules, key 16–128; atomic owner + trial | 201 workspace + membership; replay 200 | 409 slug/key conflict |
| GET /w/:w | Active membership | ID | 200 role-safe workspace + capabilities + authzRevision | E |
| PATCH /w/:w | Owner/Admin | `{name,settings,version}` N/V, settings allowlist | 200 workspace | M |
| POST /w/:w/ownership-transfer | Owner + recent reauth | `{membershipId,demoteSelf,version}` active verified staff, V; idempotency required | 200 ownership summary | 409 guard conflict |
| POST /w/:w/export-requests | Owner + recent reauth | `{scope:"workspace"}`; idempotency key | 202 `{jobId,status}`; job rechecks requester | 409 pending export |
| DELETE /w/:w | Owner + recent reauth | If-Match, `{confirmation:slug}`; idempotency required | 202 deletion request | 409 ownership/retention hold |
| GET /w/:w/jobs/:jobId | Initiator still authorized or Owner | ID | 200 `{status,progress,resultResourceId?,failureCode?}` | 404 |

## Membership and clients

| Method and URL | Permission | Request / validation | Success | Additional errors |
|---|---|---|---|---|
| GET /w/:w/members | Owner/Admin; staff scoped summary | P, `role`, `status` allowed only admins | 200 membership DTO list | E |
| POST /w/:w/invitations | Owner/Admin according to role matrix | `{email,role,clientId?}`; verified client relation; idempotency | 202 invitation summary (no token) | 409 pending invite/member |
| GET /w/:w/invitations | Owner/Admin | P/status | 200 invite summaries | E |
| DELETE /w/:w/invitations/:id | Authorized issuer capability | ID | 204 revoke | 409 already consumed |
| POST /invitations/accept | Verified signed-in matching email | `{token}`; recheck issuer/workspace validity | 200 membership | 410 expired, 409 conflicting membership |
| PATCH /w/:w/members/:id | Owner/Admin per hierarchy | `{role,version}`; role changes staff↔Client require separate offboarding/reinvite, not patch | 200 membership | 409 last owner, 422 forbidden transition |
| DELETE /w/:w/members/:id | Owner/Admin per hierarchy or self | ID + If-Match | 204 removed | 409 last owner |
| GET /w/:w/clients | Owner/Admin; Manager/Member project-linked subset | P/q/status | 200 client safe summaries | E |
| POST /w/:w/clients | Owner/Admin | `{name,website?,billingEmail?,notes?}` N/URL/email/B | 201 client | M |
| GET /w/:w/clients/:id | Owner/Admin, project-linked staff, own Client safe subset | ID | 200 role-safe client DTO | E |
| PATCH /w/:w/clients/:id | Owner/Admin | `{name?,website?,notes?,status?,version}`; archive dependency review | 200 client | 409 active dependency conflict |
| GET /w/:w/clients/:id/contacts | Owner/Admin | P/ID | 200 contacts | E |
| POST /w/:w/clients/:id/contacts | Owner/Admin | `{name,email}` N/email; identity linkage only through invite acceptance | 201 contact | 409 duplicate |
| PATCH /w/:w/clients/:id/contacts/:contactId | Owner/Admin | `{name?,status?,version}` V; email immutable once linked | 200 contact | 409 dependent access transition |

## Projects, tasks and milestones

| Method and URL | Permission | Request / validation | Success | Additional errors |
|---|---|---|---|---|
| GET /w/:w/projects | Owner/Admin all, others grants | P/q/status/clientId | 200 role-safe summaries | E |
| POST /w/:w/projects | Owner/Admin/Manager | `{name,description?,clientId?,dueAt?}` N/B/ID/D; manager self-grant | 201 project | M |
| GET /w/:w/projects/:p | Internal parent access or C | ID | 200 role-safe project | E |
| PATCH /w/:w/projects/:p | Owner/Admin/project manager | `{name?,description?,status?,clientVisible?,dueAt?,version}`; only authorized publisher changes visibility | 200 project | 422 invalid publish relation |
| DELETE /w/:w/projects/:p | Owner/Admin | ID/If-Match; idempotency | 202 soft deletion | M |
| GET /w/:w/projects/:p/grants | Owner/Admin/project manager | ID/P | 200 access grant summaries | E |
| PUT /w/:w/projects/:p/grants/:membershipId | Owner/Admin/project manager | `{accessRole,status,version?}` ID; Client relation; create has no version, update requires V | 201 created or 200 updated | 409 concurrent grant |
| GET /w/:w/tasks | Internal accessible project set or C | P/projectId/status/assigneeMembershipId/dueBefore/q; Client restricted to published | 200 safe task list | E |
| POST /w/:w/projects/:p/tasks | Internal project access | `{title,description?,status?,priority?,assigneeMembershipId?,dueAt?,milestoneId?}` T/B/ID/D, assignment rules; idempotency | 201 task | 422 invalid assignee/milestone |
| GET /w/:w/tasks/:t | Internal parent access or C | ID | 200 task DTO; Client DTO excludes internal description/assignment/history | E |
| PATCH /w/:w/tasks/:t | Owner/Admin/project manager or Own | `{title?,description?,publicSummary?,status?,priority?,dueAt?,assigneeMembershipId?,milestoneId?,clientVisible?,version}`; field-by-field policy; publicSummary/publication manager-only | 200 task + new version | 403 disallowed field, M |
| POST /w/:w/tasks/:t/move | Same task edit authority | `{status,beforeTaskId?,afterTaskId?,version}` neighbors must match project/target column; both cannot imply invalid order | 200 task/rank/version | 409 stale board ordering |
| DELETE /w/:w/tasks/:t | Owner/Admin/project manager | ID/If-Match | 204 soft delete | M |
| GET /w/:w/tasks/:t/comments | Parent access | P | 200 filtered comment list | E |
| POST /w/:w/tasks/:t/comments | Parent access | `{body,visibility}` B; public only on published parent; idempotency | 201 comment | 422 visibility conflict |
| PATCH /w/:w/comments/:id | Author + current parent access | `{body,version}` B/V | 200 comment | M |
| DELETE /w/:w/comments/:id | Author or authorized moderator | ID/If-Match | 204 redacted | M |
| GET /w/:w/projects/:p/milestones | Parent access, Client published only | P | 200 milestone list | E |
| POST /w/:w/projects/:p/milestones | Owner/Admin/project manager | `{title,description?,dueAt,clientVisible?}` T/B/D | 201 milestone | M |
| PATCH /w/:w/milestones/:id | Owner/Admin/project manager | `{title?,description?,dueAt?,status?,clientVisible?,version}` | 200 milestone | M |
| DELETE /w/:w/milestones/:id | Owner/Admin/project manager | ID/If-Match; controlled unlink | 204 | 409 pending unlink |

Client task DTO exposes publicSummary instead of internal description; publication requires a nonempty summary. Client sees id, version, title, publicSummary, status, dueAt and published milestone links only. Project Client DTO exposes id, name, status and dueAt, excluding internal description/grants/staff. Shared titles and milestone descriptions must be reviewed before publication. Public DTOs contain only explicitly published metadata; internal activity and counts are excluded.

## Files and support

| Method and URL | Permission | Request / validation | Success | Additional errors |
|---|---|---|---|---|
| POST /w/:w/attachments/upload-intents | Authorized parent writer; Client ticket only | `{parentType,parentId,name,sizeBytes,contentType,checksum,visibility}` type allowlist, ≤20 MiB, parent policy; idempotency | 201 `{attachmentId,uploadUrl,requiredHeaders,expiresAt}` (5 min upload) | 413 size, 415 type, 409 storage limit |
| POST /w/:w/attachments/:id/finalize | Original uploader + parent access | `{checksum}`; HEAD verifies actual object length/type, enqueue scan durably | 202 attachment status | 409 incomplete, 422 mismatch |
| GET /w/:w/attachments/:id | Parent access | ID | 200 metadata/status, no object key | E |
| POST /w/:w/attachments/:id/download-url | Current parent reader | No body; CSRF; clean only | 200 `{url,expiresAt}` ≤60 s; attachment disposition | 409 scan pending, 403 quarantine |
| PATCH /w/:w/attachments/:id | Authorized publisher | `{visibility,version}` parent must be published for client | 200 attachment metadata | 422 parent mismatch |
| DELETE /w/:w/attachments/:id | Uploader with parent write or parent manager | ID/If-Match | 202 revoked and purge queued | M |
| GET /w/:w/tickets | Owner/Admin; assigned staff; same-client Client | P/status/priority/assigneeMembershipId/projectId | 200 safe ticket summaries | E |
| POST /w/:w/tickets | Client own client; authorized staff | `{subject,body,projectId?,clientId?}` T/B; server derives clientId for Client; staff relationship checked; idempotency | 201 ticket + first public message | M |
| GET /w/:w/tickets/:id | Ticket policy in document 02 | ID | 200 ticket safe DTO | E |
| PATCH /w/:w/tickets/:id | Owner/Admin/project manager or assigned staff | `{status?,priority?,assigneeMembershipId?,version}`; assignment restricted to Owner/Admin/project manager | 200 ticket | 403 field denied, M |
| GET /w/:w/tickets/:id/messages | Ticket reader | P; Client sees public only | 200 message list | E |
| POST /w/:w/tickets/:id/messages | Ticket reader/replier | `{body,visibility}` B; client always public; idempotency | 201 message | 422 visibility |
| GET /w/:w/notifications | Own active membership | P/unread boolean | 200 own safe inbox | E |
| PATCH /w/:w/notifications/:id | Recipient only | `{read:true}` idempotent set | 200 read state | 404 |
| POST /w/:w/notifications/read-all | Recipient only | `{before:ISODate}` bounded snapshot | 200 `{updatedCount}` | E/M |

## Knowledge, AI, analytics and subscriptions

| Method and URL | Permission | Request / validation | Success | Additional errors |
|---|---|---|---|---|
| GET /w/:w/knowledge/documents | Internal staff scoped source access | P/projectId/status/q | 200 safe document summaries | E |
| POST /w/:w/knowledge/documents | Owner/Admin; project Manager for project scope | `{title,scope,projectId?,sourceText}` T; text 1–100k chars; idempotency | 202 document + jobId | 409 quota, 422 scope |
| POST /w/:w/knowledge/document-reservations | Same source management policy | `{title,scope,projectId?}` T/ID; idempotency | 201 awaiting_upload document; use its ID as upload parent | 409 quota, 422 scope |
| POST /w/:w/knowledge/documents/:id/ingest | Source manager | `{attachmentId,version}` ID/V; clean attachment must have this document as parent; idempotency | 202 pending document + jobId | 409 not clean/already processing, 422 parent |
| GET /w/:w/knowledge/documents/:id | Source reader | ID | 200 metadata/status/authorized source link | E |
| POST /w/:w/knowledge/documents/:id/reindex | Source manager | `{version}`; idempotency | 202 new generation + jobId | 409 processing |
| DELETE /w/:w/knowledge/documents/:id | Source manager | ID/If-Match | 202 revoked + purge job | M |
| POST /w/:w/ai/answers | Entitled internal member | `{question,projectId?,sourceIds?}` 1–4000 chars, ≤50 selected IDs, source ACL; idempotency | 200 `{answer,citations,usage,requestKey}` | 429 quota, 502 invalid provider response, 504 timeout |
| POST /w/:w/ai/task-drafts | Entitled internal project member | `{projectId,prompt}` ≤4000 chars; no executable tool action | 200 `{draft:{title,description},usage}` | Same AI errors |
| GET /w/:w/ai/usage | Owner/Admin aggregate; others self | P/period monthly max 12 periods | 200 usage + remaining entitlement | E |
| GET /w/:w/analytics/overview | Owner/Admin workspace; Manager P; Member own; Client portal-only summary | `projectId?,from,to` max 366 days; server narrows scope | 200 counts/aging/methodology/asOf | 422 range, 403 broad scope |
| GET /w/:w/activity | Owner/Admin or project member/public Client subset | P/projectId/resourceType | 200 safe authorized activity | E |
| GET /w/:w/audit-logs | Owner/Admin | P/action/from/to bounded | 200 restricted security metadata | E |
| GET /plans | Public | currency allowlist | 200 active plan revisions; prices only after selection | 503 catalog not configured |
| GET /w/:w/subscription | Owner | No body | 200 plan/status/entitlements/paidThrough | E |
| GET /w/:w/subscription/events | Owner | P | 200 sanitized mapped billing-event history | E |
| POST /w/:w/subscription/checkout-sessions | Owner + recent reauth | `{planId}` server-selected provider price, fixed allowlisted return paths; idempotency | 201 `{checkoutUrl,expiresAt}` | 409 active conflicting flow, 503 unconfigured provider |
| POST /w/:w/subscription/portal-sessions | Owner + recent reauth | No body; idempotency, fixed return path | 201 hosted portal URL | 409 no provider customer |
| POST /billing/webhooks/:provider | Verified provider signature only | raw bounded body, timestamp tolerance, known provider enum | 200 accepted/duplicate after durable intake | 400 bad signature/payload, 503 intake unavailable |

Job status is backed by outbox/job metadata, not a new unscoped arbitrary job lookup: only job IDs belonging to workspace and actor capability can be resolved. Hosted checkout redirect does not activate entitlement; verified/reconciled provider state does. Plans/price IDs cannot be set by browser. Cancellation and payment details are handled in provider portal; no card data enters FlowWork AI. Proposed entitlement policy: cancellation retains access until paid-through date; past-due has a seven-day grace capped by approved provider state, then read/export access remains while new writes/AI/uploads are blocked. Account security, logout and billing recovery remain available. Trial duration and actual plan limits require commercial approval in Phase 11; Phase 5 uses an explicitly configured non-paid pilot entitlement, not a payment integration.

## Idempotency, rate limits and versioning

Require `Idempotency-Key` (16–128 printable safe characters) for task/comment/ticket creation, invites, AI requests, uploads and sensitive workspace/billing actions. Key scope is actor+workspace+route, digest covers canonical body. Same key and digest returns original resource outcome; different body returns 409 `IDEMPOTENCY_CONFLICT`; in-progress returns 409 with Retry-After. Retain for 24 h; financial provider operations additionally use provider keys and persistent billing-event uniqueness. Upload replay regenerates a fresh signed URL only after reauthorization, never returns an expired cached secret. AI replay returns a safe authorized result or status; because raw answers are not persisted at launch, repeat completed request returns usage/requestKey and `resultUnavailable:true` if the original response was lost, without rerunning/billing. UI must show an explicit new-request action. Do not claim exactly-once network delivery.

Candidate shared Redis-backed limits: login 5/min per IP+normalized identity, 20/min per IP; reset 3/h per identity, 20/h per IP; general API 120/min per user/workspace; writes 30/min; upload intents 10/min; AI 10/min per user and 2 concurrent/workspace plus plan monthly budget. Also cap anonymous edge traffic by IP. Distributed enforcement, trusted-proxy configuration and IPv6 normalization are mandatory. Return 429 with Retry-After and safe limit metadata. Tune through load/abuse tests, not by declaring current capacity. Provider webhook uses signature validation, body cap and separate provider-aware ingress limit; do not accidentally throttle legitimate retries as user traffic.

Every idempotent replay rechecks current membership, resource access and response-field policy; a cached result must never resurrect revoked visibility. Signed storage/provider session URLs are regenerated only through current authorization and provider session policy, not stored in generic safeResponse. Entitlement reservations for concurrent seat invitations/acceptance, storage intents and AI requests must be atomic, with abandoned reservations reconciled rather than counted forever. Seat policy counts active internal memberships (including Owners/Admins); Client contacts are a separate limit. Do not count every invitation as a permanently consumed seat.

`/api/v1` evolves additively; removing/renaming fields or changing semantics requires `/v2`, migration notes, a documented deprecation window and client compatibility tests. Errors use stable codes. Future executable OpenAPI derives from shared transport contracts; Phase 1 Markdown is the source design, not a claim of generated SDK availability.

## Representative exchanges

```http
POST /api/v1/w/507f1f77bcf86cd799439011/projects/507f191e810c19729de860ea/tasks
Content-Type: application/json
X-CSRF-Token: illustrative-csrf-token
Idempotency-Key: task-create-example-001

{"title":"Review client dashboard","status":"todo","priority":"normal"}
```

```json
{
  "data": {
    "id": "507f1f77bcf86cd799439012",
    "projectId": "507f191e810c19729de860ea",
    "title": "Review client dashboard",
    "status": "todo",
    "clientVisible": false,
    "version": 1,
    "createdAt": "2026-11-06T09:00:00.000Z",
    "updatedAt": "2026-11-06T09:00:00.000Z"
  },
  "meta": {"requestId":"req_example"}
}
```

```json
{
  "error": {
    "code": "VERSION_CONFLICT",
    "message": "This task changed. Refresh before saving.",
    "details": [{"path":"version","message":"A newer version exists"}]
  },
  "meta": {"requestId":"req_conflict"}
}
```

```json
{
  "data": {
    "answer": "The published project brief calls for a review before delivery.",
    "citations": [{"documentId":"507f1f77bcf86cd799439013","chunkOrdinal":2,"generation":1}],
    "usage": {"inputTokens":450,"outputTokens":24},
    "requestKey":"answer-example-001"
  },
  "meta": {"requestId":"req_ai"}
}
```

The AI example is illustrative output, not an assertion about any existing source. Citation URLs are resolved by an authorized application route; model-supplied arbitrary URLs are not trusted.

## Implemented Phase 5 contract

[OpenAPI 0.5](../backend/openapi.json) and [tenant architecture](phase-5-multi-tenant-architecture.md) are authoritative for current routes; earlier business tables remain targets. Company routes use `/organizations/:orgId`; workspace routes use `/workspaces/:workspaceId`, and the current user list is `/me/workspaces`. Both support `members` and `invitations` subresources. Create/read/update companies and workspaces, list/change/revoke scoped memberships, issue/resend/revoke invitations, POST token preview and POST acceptance are implemented. There is no company/workspace hard-delete or ownership-transfer API. Unsafe requests require cookies, exact Origin and signed CSRF.

Current list responses are `{data:{items,nextCursor,hasMore},meta:{requestId}}`, default 20/max 50, ascending ObjectID cursor. Cursors are format-validated and filters always reapply current tenant authorization; they are not the historical signed cursor proposal. Settings PATCH requires integer `version`; creation requires a UUID `creationKey`. Company slugs are immutable and globally unique; workspace slugs are unique within the parent. Strict body/query/parameter validation returns 422; unrelated scopes return concealed 404, denied capabilities 403, conflicts/owner protection 409 and unusable invitations 410. See OpenAPI for exact payload allowlists.
