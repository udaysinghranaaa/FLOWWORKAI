# ADR 011: Project grants and transactional work management

Status: accepted for locally implemented Phase 6; live initialization requires separate environment approval after private rotation and Phase 5 rollout.

Extend existing organization/workspace tenancy rather than introducing another authentication or RBAC system. Project capability evaluation lives beside Phase 5's permission matrix. Company/workspace OWNER/ADMIN retain inherited project administration. A workspace MANAGER can create projects and administer one only through ownership or a MANAGER project grant. MEMBER contributes with a CONTRIBUTOR grant. VIEWER remains read-only regardless of a stale stronger grant. A grant never substitutes for current active company/workspace membership or a verified active account.

Each project has one mutable owner, independent from immutable Phase 5 founding ownership. Transfer requires an eligible project administrator and ensures the new owner's MANAGER grant. A project owner cannot be removed before transfer. Company/workspace founding ownership rules do not change.

Project, task, grant, comment and activity writes reuse the existing identity/session transaction locks and organization guard. An additional project version serializes its work and supplies optimistic board/version checks. Activities commit in the same transaction as business state. This sacrifices some cross-project write throughput for a clear first-release correctness boundary; future optimization must retain revocation ordering.

Board columns use active-task unique scoped integer positions. Normal insert/move chooses the midpoint of a gap or appends, updating one task. If no integer gap remains, a bounded two-pass transactional rebalance assigns temporary negative positions then valid positive gaps. No observer sees temporary positions. Board revisions reject stale neighbor-based moves. General task status changes append to the current destination based on the server's transaction snapshot. Top-level cards and subtasks have separate ordering groups.

Archive instead of hard delete. Project archive retains all tasks and history but disables edits and excludes that project's tasks from default metrics. Parent-task archive atomically archives one-level children. Restore does not silently restore children; each can be explicitly restored after its parent. Completion remains independent. Comments are plain text, author/moderator controlled, versioned and soft-deleted. No real-time chat, client portal or Phase 7 scope is added.

One backend configuration endpoint provides status labels, priorities and defaults to the real UI. The historical public demo keeps its own unchanged presentation enums and in-memory behavior. Real UI keys include identity/workspace/project and cancel on workspace switching; optimistic board previews roll back and refetch on failure.

Schema creation is automatic only in generated test fixtures. Normal startup verifies index metadata and fails closed if work schema is absent. The schema command defaults to a read-only static plan and requires explicit apply, rotation, schema approval and environment acknowledgment flags for changes. The agent will not run apply against Atlas in this task.
