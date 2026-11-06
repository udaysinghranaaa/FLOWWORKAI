# 02 · Roles and permissions

Status: proposed policy, enforced in future backend implementation. This document is the canonical permission authority for all other plans.

## Evaluation model

Authentication proves a global user/session identity. Authorization answers whether that identity may perform an operation on a resource **now**. RBAC supplies broad capabilities; resource checks narrow them using active workspace membership, project grant, client association, ownership, parent visibility and current entitlement. Deny by default. A role is a workspace membership field, never a client-supplied claim to trust.

An active membership has one role: Owner, Admin, Manager, Member or Client. Multiple owners are allowed. Internal project grants have `accessRole: manager|contributor`; a Manager workspace role still requires a manager grant to administer that project. Members have contributor grants only. A Manager with only a contributor grant receives contributor permissions there. Clients have `accessRole: viewer`, a matching clientId and explicit project access. Owner/Admin bypass project grants for internal access but do not bypass tenant context, security checks or audit.

Permission notation: **All** = all resources within current workspace; **P** = granted project, at manager level where management is required; **Own** = creator/assignee plus parent access; **C** = same client account, explicit grant and published parent/child; **—** = denied. All abilities require an active membership. Managers manage only project resources; directory administration is not implied.

## Permission matrix

| Capability | Owner | Admin | Manager | Member | Client |
|---|---|---|---|---|---|
| Read workspace basic name/branding | All | All | Yes | Yes | Portal subset |
| Change workspace configuration | All | All except ownership/deletion/billing | — | — | — |
| Invite Manager/Member/Client | All | All | — | — | — |
| Invite or promote Admin/Owner | All, recent reauth | — | — | — | — |
| Remove non-owner/non-admin member | All | All | — | — | — |
| Remove/demote Admin or Owner | All, last-owner rule | — | — | — | — |
| Leave workspace | Last-owner rule | Yes | Yes | Yes | Yes |
| Change staff roles | All | Manager/Member/Client only; no self-escalation | — | — | — |
| List internal staff / directory | All | All | Staff summary for assignment | Staff summary in P | — |
| Create/edit client/contact | All | All | — | — | — |
| View client details | All | All | P linked client summary | P linked client summary | Own company safe fields |
| Create project | All | All | Yes, self manager grant | — | — |
| Edit project metadata/grants | All | All | P manager grant | — | — |
| Delete/archive project | All | All | Archive P only | — | — |
| Read internal project/task | All | All | P | P | — |
| Read published project/task | All | All | P | P | C |
| Create task | All | All | P | P | — |
| Assign/reassign task | All | All | P manager | Self-assign only if unassigned or Own | — |
| Edit title/body/status/due date | All | All | P manager; otherwise Own | Own | — |
| Delete task | All | All | P manager | — | — |
| Create/edit milestone | All | All | P manager | — | — |
| Publish task/milestone/file to client | All | All | P manager | — | — |
| Create internal comment | All | All | P | P | — |
| Create public comment | All | All | P on published parent | P on published parent | C |
| Edit own comment | Parent access | Parent access | Own + P | Own + P | Own + C |
| Remove other's comment | All, audited | All, audited | P manager, audited | — | — |
| Upload/download attachment | Parent access | Parent access | Parent access | Parent access | C clean files; own ticket uploads |
| Create ticket | All | All | Assigned client/project context | Assigned project context | Own client |
| Read/assign/resolve tickets | All | All | P manager or specifically assigned ticket | Assigned ticket only | Read/reply own client public thread |
| Add internal ticket note | All | All | Authorized ticket | Assigned ticket | — |
| Use FlowAI | Entitled | Entitled | Entitled + P sources | Entitled + P sources | — |
| Manage knowledge documents | All | All | P manager on project documents | — | — |
| Read knowledge | Allowed scope | Allowed scope | P and workspace-internal sources | P and workspace-internal sources | — |
| View analytics | Workspace | Workspace | P | Own work counts | Portal milestone summary |
| Billing/subscription | All, recent reauth for writes | — | — | — | — |
| Workspace export/deletion/ownership transfer | All, recent reauth | — | — | — | — |
| View audit logs | All | All excluding restricted platform records | — | — | — |
| Read/update own profile/sessions/notifications | Own | Own | Own | Own | Own |

An assigned ticket grants only that ticket and its necessary client summary, not its project's tasks. Client contacts belonging to one client may see that client's tickets; contact-private tickets are post-MVP. Task ownership cannot grant access after project removal. Changing a task's project is not supported in MVP; it would require full reference and visibility revalidation.

## Implementation contract

Request policy order: validate identity/session → parse workspace ID → load active membership → derive capabilities → load target with workspace filter → check parent/project/client relation and field-level action → check entitlement if applicable → perform scoped mutation with concurrency condition → write audit/outbox records.

- Use `findOne({_id, workspaceId, ...policyConstraints})`, never unscoped lookup followed by optimistic trust. Related IDs use the same workspace and parent filters. Aggregation lookups require tenant predicates on both sides.
- Existing-but-inaccessible resource IDs return 404 to avoid enumeration. An authenticated caller lacking a capability on a resource already visible to them receives 403. Invalid relationship input returns generic 422.
- Server maps allowed write fields and response DTOs by role. Clients never receive internal fields even if the UI hides them. Mass assignment of role, clientId, visibility, workspaceId or owner fields is denied.
- IDs in cookies, routes, socket payloads, job arguments, presigned URLs and AI suggestions are untrusted inputs. Queue workers resolve and reauthorize the initiator at execution time for user-triggered actions.
- Cache and query keys include userId, workspaceId and effective access revision. Workspace switches clear old UI and disconnect old rooms before fetching new data.

## Ownership and revocation

Workspace has `ownerCount` and `authzRevision`. Ownership changes run a MongoDB transaction: conditionally update the same workspace record with `ownerCount > 1` for removal/demotion, mutate memberships and increment revision. Concurrent transactions therefore contend on one guard record; counting memberships alone is insufficient under snapshot isolation. Invitations cannot create an owner without Owner-authorized issuance. Reconcile ownerCount periodically; mismatch blocks ownership mutations for repair. Transfer promotes an active verified internal member and optionally demotes the initiator atomically.

Removing a membership increments authzRevision and revokes its grants; associated socket connections leave rooms/disconnect. Global sessions remain valid for other workspaces. Every HTTP request and socket message loads current membership; revocation broadcasts hasten removal but are not the sole enforcement. Async delivery workers recheck recipients. A short-lived already-issued download URL may work until expiry (maximum 60 seconds); sensitive data can instead stream through an authorized proxy. Global account disable/password reset revokes all session families.

## Platform operations boundary

Platform operators are separate infrastructure identities with MFA and least privilege, not a sixth workspace role. No default UI impersonation or cross-tenant content browsing. Break-glass support requires an explicit support case, documented customer consent where applicable, time-limited elevation and immutable audit of access. Platform billing reconciliation reads minimal provider/account metadata. Production database access is not an alternative to application authorization.
