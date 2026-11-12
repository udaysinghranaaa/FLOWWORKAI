# ADR 010: Organization parent, live RBAC and immutable founding ownership

Status: accepted for the explicit Phase 5 implementation; live schema rollout pending private credential rotation.

The earlier workspace-centric plan cannot represent a company owning multiple workspaces. Phase 5 adds Organization as the company boundary and retains Workspace as a child. Organization IDs and workspace IDs are distinct. Shared collections use scoped identifiers and unique compound indexes.

Organization roles are OWNER, ADMIN and MEMBER. Workspace roles are OWNER, ADMIN, MANAGER, MEMBER and VIEWER. Organization OWNER/ADMIN explicitly inherit workspace administration; all other accounts require an active workspace membership plus active company membership. MANAGER has read-only current team/settings capabilities, leaving project-specific management for a later authorized phase. This supersedes earlier role-planning examples only for implemented Phase 5 operations.

Each organization/workspace has one immutable founding owner. APIs cannot grant OWNER, demote/remove an OWNER, or remove company membership while the account owns a workspace. Partial unique active-owner indexes and atomic creation enforce the invariant. Ownership transfer/multiple-owner support is deferred and must be a separately designed transaction, not an unrestricted role edit.

Current database membership, not JWT role claims, authorizes each request. Mutations recheck identity/session/membership in snapshot transactions and contend on a shared organization revision guard. Unique indexes provide duplicate protection, and UUID creation keys provide safe retries. Workspace routing uses immutable IDs and user/tenant-scoped query caches.

Invitations store only hashes of random 256-bit tokens. Explicit acceptance requires the matching verified email and revalidates the issuer's current permissions. Token expiry is checked in queries; TTL only purges old records. Existing active memberships retain their roles. Email dispatch follows commit, using existing private capture/SMTP; durable mail delivery/outbox remains a documented limitation.

Live schema installation is explicit and additive after rotation. The default server checks required index metadata and fails closed rather than silently provisioning Phase 5 business schema. Tests provision only generated isolated replica sets. No Phase 6 project/task persistence is authorized by this decision.
