# Phase 5 interview notes

These notes describe the implemented repository. Examples are exact source excerpts; surrounding imports, object fields and function bodies are omitted. Consult the linked architecture for exact policy and limitations.

## 1. What is multi-tenancy?

**WHAT?** Multiple customers use one application while their private resources remain isolated.

**WHY?** Shared infrastructure lowers operational cost without granting shared access.

**HOW?** Resolve current organization/workspace membership before reading any private resource.

**REAL CODE EXAMPLE?** [backend/src/modules/organizations/tenant.service.ts](../backend/src/modules/organizations/tenant.service.ts):

```ts
    const organization = await repository.organization(organizationId, session)
const member = await repository.organizationMembership(organizationId, actor.userId, session)
```

**INTERVIEW ANSWER?** I model tenants explicitly and prove isolation on every request, including authenticated requests.

## 2. SaaS architecture

**WHAT?** A hosted application provides a continuing service to independent customer organizations.

**WHY?** Identity, tenant administration and lifecycle must work consistently across customers.

**HOW?** Use the existing modular monolith, shared database and clear service boundaries.

**REAL CODE EXAMPLE?** [backend/src/server.ts](../backend/src/server.ts):

```ts
    const tenants = createTenantService({
      models: tenantModels,
      authModels: models,
```

**INTERVIEW ANSWER?** A modular monolith supplies one operational unit while keeping identity and tenant policy explicit.

## 3. Single-tenant versus multi-tenant

**WHAT?** Single-tenant deployments isolate infrastructure; multi-tenant systems share some infrastructure.

**WHY?** Deployment isolation and application authorization solve related but different problems.

**HOW?** FlowWork shares collections and scopes access through company and workspace memberships.

**REAL CODE EXAMPLE?** [backend/src/modules/organizations/tenant.repository.ts](../backend/src/modules/organizations/tenant.repository.ts):

```ts
    organizationMembership: (organizationId: string, userId: string, session?: ClientSession) =>
      models.OrganizationMembership.findOne({ organizationId, userId, status: 'active' }).session(
        session ?? null,
```

**INTERVIEW ANSWER?** Shared deployment never means shared customer permissions.

## 4. Shared DB versus separate DB

**WHAT?** Tenant records can share collections or live in distinct databases.

**WHY?** Separate databases add operational overhead; shared collections demand disciplined scoped queries.

**HOW?** Choose shared collections, tenant identifiers and compound indexes for this phase.

**REAL CODE EXAMPLE?** [backend/src/modules/workspaces/workspace.model.ts](../backend/src/modules/workspaces/workspace.model.ts):

```ts
workspaceSchema.index({ organizationId: 1, normalizedSlug: 1 }, { unique: true })
workspaceSchema.index({ organizationId: 1, createdBy: 1, creationKey: 1 }, { unique: true })
workspaceSchema.index({ organizationId: 1, status: 1, _id: 1 })
```

**INTERVIEW ANSWER?** I choose the isolation boundary deliberately and pair shared storage with centralized authorization.

## 5. Organization versus workspace

**WHAT?** An organization is a company; a workspace is a child working environment.

**WHY?** One business may need several independent teams without becoming several customers.

**HOW?** Every workspace has an immutable organizationId; both scopes have distinct membership roles.

**REAL CODE EXAMPLE?** [backend/src/modules/organizations/tenant.repository.ts](../backend/src/modules/organizations/tenant.repository.ts):

```ts
    workspace: (organizationId: string, workspaceId: string, session?: ClientSession) =>
      models.Workspace.findOne({ _id: workspaceId, organizationId }).session(session ?? null),
    workspaceMembership: (
```

**INTERVIEW ANSWER?** Company administration and workspace administration are distinct scopes with documented inheritance.

## 6. Tenant ID

**WHAT?** An immutable identifier associates a record with its owning customer boundary.

**WHY?** Names and slugs change; resource identifiers must not accidentally change authority.

**HOW?** Validate ObjectID syntax, derive parent relationships and authorize current membership.

**REAL CODE EXAMPLE?** [backend/src/modules/organizations/tenant.schema.ts](../backend/src/modules/organizations/tenant.schema.ts):

```ts
export const idSchema = z.string().regex(/^[a-f0-9]{24}$/)
const name = z.string().trim().min(2).max(120)
export const slugSchema = z
```

**INTERVIEW ANSWER?** An ID is a locator, not a permission; syntactically valid IDs still require authorization.

## 7. RBAC

**WHAT?** Role-based access control maps named roles to explicit capabilities.

**WHY?** Central capabilities avoid scattered role string comparisons as the application grows.

**HOW?** Use separate organization and workspace matrices plus target-role restrictions.

**REAL CODE EXAMPLE?** [backend/src/modules/memberships/permissions.ts](../backend/src/modules/memberships/permissions.ts):

```ts
export const workspacePermissionMatrix: Record<WorkspaceRole, readonly Permission[]> = {
  OWNER: [...workspacePermissions],
  ADMIN: [...workspacePermissions],
```

**INTERVIEW ANSWER?** Roles explain capabilities; services enforce both the capability and the resource boundary.

## 8. Authentication versus authorization

**WHAT?** Authentication identifies the caller; authorization decides whether that caller may act on a resource.

**WHY?** A valid login must not expose another company.

**HOW?** Check the active database session, then current scoped membership and permission.

**REAL CODE EXAMPLE?** [backend/src/modules/organizations/tenant.routes.ts](../backend/src/modules/organizations/tenant.routes.ts):

```ts
  router.use(tenantPaths, requireAuth(runtime.service, cookies))
  endpoint(
    'post',
```

**INTERVIEW ANSWER?** Authentication is necessary but never sufficient for tenant access.

## 9. Permission matrix

**WHAT?** A matrix explicitly maps each role to allowed operations.

**WHY?** Reviewers can inspect policy and tests can cover every row.

**HOW?** OWNER/ADMIN have scoped administration; current MANAGER/MEMBER/VIEWER team/settings operations are read-only.

**REAL CODE EXAMPLE?** [backend/src/modules/memberships/permissions.ts](../backend/src/modules/memberships/permissions.ts):

```ts
  MANAGER: ['workspace.read', 'workspace.members.read'],
  MEMBER: ['workspace.read', 'workspace.members.read'],
  VIEWER: ['workspace.read', 'workspace.members.read'],
```

**INTERVIEW ANSWER?** Document inheritance and denials together so implicit grants cannot appear unnoticed.

## 10. Middleware authorization

**WHAT?** Middleware resolves identity and resource scope before controllers run.

**WHY?** Common checks should be consistent across endpoints.

**HOW?** Strict validation precedes tenant middleware; transactional services reauthorize writes.

**REAL CODE EXAMPLE?** [backend/src/middleware/tenant-context.ts](../backend/src/middleware/tenant-context.ts):

```ts
export function requireTenant(
  service: TenantService,
  scope: 'organization' | 'workspace',
```

**INTERVIEW ANSWER?** Middleware gives an early boundary, while service authorization protects races and non-HTTP reuse.

## 11. IDOR vulnerabilities

**WHAT?** Insecure direct object reference occurs when a caller changes an ID to access another resource.

**WHY?** Valid ObjectIDs are easy to copy and are not secrets.

**HOW?** Conceal unrelated resources and scope subordinate member/invitation lookups to the parent tenant.

**REAL CODE EXAMPLE?** [backend/src/modules/organizations/tenant.service.ts](../backend/src/modules/organizations/tenant.service.ts):

```ts
    const filter = {
      organizationId,
      ...(workspaceId ? { workspaceId } : {}),
```

**INTERVIEW ANSWER?** I prevent IDOR by verifying the relationship and permission, not by making IDs harder to guess.

## 12. Horizontal privilege escalation

**WHAT?** A caller crosses from one peer customer or workspace into another.

**WHY?** Login alone does not distinguish authorized tenants.

**HOW?** Require active company membership and explicit workspace membership unless company administration is inherited.

**REAL CODE EXAMPLE?** [backend/tests/tenants.test.ts](../backend/tests/tenants.test.ts):

```ts
  it('conceals unrelated tenant IDs and protects scoped mutations', async () => {
    const a = await verifiedBrowser(f),
      b = await person('other@example.com')
```

**INTERVIEW ANSWER?** I test two real tenants and try each read and mutation with the other tenant?s account.

## 13. Vertical privilege escalation

**WHAT?** A caller obtains capabilities above their authorized role.

**WHY?** Accepting client role fields or stale role claims can turn a viewer into an administrator.

**HOW?** Strict role schemas exclude OWNER; services restrict ADMIN grants, target admins and self edits.

**REAL CODE EXAMPLE?** [backend/src/modules/organizations/tenant.service.ts](../backend/src/modules/organizations/tenant.service.ts):

```ts
      if (String(member.userId) === actor.userId) throw forbidden()
      const canManageAdmins =
        context.organizationRole === 'OWNER' ||
```

**INTERVIEW ANSWER?** The server decides assignable roles based on current scope and the target, never the UI.

## 14. Database indexes

**WHAT?** Indexes support bounded lookup and enforce some uniqueness invariants.

**WHY?** Application checks alone race under simultaneous writes.

**HOW?** Declare indexes with automatic creation disabled and verify their metadata before live startup.

**REAL CODE EXAMPLE?** [backend/src/modules/organizations/tenant.schema-initialization.ts](../backend/src/modules/organizations/tenant.schema-initialization.ts):

```ts
      const indexes = await model.collection.listIndexes().toArray()
      for (const [keys, options] of model.schema.indexes()) {
        if (
```

**INTERVIEW ANSWER?** Indexes are both a performance tool and part of the correctness model.

## 15. Compound indexes

**WHAT?** A compound index orders or constrains several fields together.

**WHY?** A workspace slug is unique within its company, not globally.

**HOW?** Use organization/slug and workspace/user unique indexes with tenant-scoped query predicates.

**REAL CODE EXAMPLE?** [backend/src/modules/memberships/membership.models.ts](../backend/src/modules/memberships/membership.models.ts):

```ts
workspaceMembershipSchema.index({ workspaceId: 1, userId: 1 }, { unique: true })
workspaceMembershipSchema.index({ organizationId: 1, userId: 1, status: 1 })
workspaceMembershipSchema.index(
```

**INTERVIEW ANSWER?** The index key must match the business scope of uniqueness.

## 16. MongoDB transactions

**WHAT?** Transactions atomically commit several document changes.

**WHY?** A company without its founding memberships is an invalid intermediate state.

**HOW?** Use a replica set, snapshot read concern, majority writes and transactional creation.

**REAL CODE EXAMPLE?** [backend/src/modules/organizations/tenant.service.ts](../backend/src/modules/organizations/tenant.service.ts):

```ts
      return await session.withTransaction(
        async () => {
          const user = await authModels.User.findOneAndUpdate(
```

**INTERVIEW ANSWER?** Multi-document invariants need transactions; individual atomic inserts do not suffice.

## 17. Atomicity

**WHAT?** An operation either commits all required effects or commits none.

**WHY?** Onboarding must not leave half-created tenants after errors.

**HOW?** Insert organization, workspace and both founding memberships in one transaction; inject a failing membership write in tests.

**REAL CODE EXAMPLE?** [backend/tests/tenants.test.ts](../backend/tests/tenants.test.ts):

```ts
  it('rolls onboarding back if founding membership persistence fails', async () => {
    const owner = await verifiedBrowser(f)
    const original = f.tenantModels!.WorkspaceMembership.create
```

**INTERVIEW ANSWER?** I test the rollback path, not just a successful sequence of inserts.

## 18. Race conditions

**WHAT?** Concurrent operations can observe old state and violate an invariant.

**WHY?** Role revocation, invitation acceptance and settings updates may overlap.

**HOW?** Reauthorize in the transaction, touch a shared company guard and use optimistic settings versions.

**REAL CODE EXAMPLE?** [backend/src/modules/organizations/tenant.service.ts](../backend/src/modules/organizations/tenant.service.ts):

```ts
  async function guardOrganization(
    organizationId: string,
    session: ClientSession,
```

**INTERVIEW ANSWER?** I identify shared invariants and serialize conflicting writes through a common guard document.

## 19. Invitation token security

**WHAT?** A random bearer link proves possession of a scoped invitation, not verified account identity.

**WHY?** A leaked database token must not become a usable invitation.

**HOW?** Generate 256-bit random tokens, store SHA-256 hashes, check expiry and email, consume once and rotate on resend.

**REAL CODE EXAMPLE?** [backend/src/modules/auth/auth.crypto.ts](../backend/src/modules/auth/auth.crypto.ts):

```ts
export const randomToken = () => randomBytes(32).toString('base64url')
export const tokenHash = (value: string) => createHash('sha256').update(value).digest('hex')
export const validId = (value: unknown): value is string =>
```

**INTERVIEW ANSWER?** A safe invitation combines unpredictable token possession with matching verified email and current issuer authority.

## 20. Ownership invariants

**WHAT?** Every organization/workspace must retain an active owner.

**WHY?** Deleting or demoting the last owner strands administration.

**HOW?** Phase 5 uses one immutable founding OWNER, partial unique owner indexes and transactional founding records.

**REAL CODE EXAMPLE?** [backend/src/modules/organizations/tenant.service.ts](../backend/src/modules/organizations/tenant.service.ts):

```ts
      if (member.role === 'OWNER')
        throw conflict(
          'Founding ownership is protected. Ownership transfer is not available in Phase 5.',
```

**INTERVIEW ANSWER?** An explicit immutable-owner restriction is safer than an incomplete ownership-transfer feature.

## 21. Workspace switching

**WHAT?** Switching selects a different authorized workspace context in the same application.

**WHY?** Cached content from the previous tenant must not flash or grant authority.

**HOW?** Cancel old queries, remove old workspace cache, navigate by ID and mount only after server context succeeds.

**REAL CODE EXAMPLE?** [frontend/src/features/workspaces/tenant-shell.tsx](../frontend/src/features/workspaces/tenant-shell.tsx):

```ts
              await client.cancelQueries({ queryKey: ['tenant', user?.id] })
              client.removeQueries({
                predicate: (query) =>
```

**INTERVIEW ANSWER?** The URL chooses a candidate workspace; the server confirms current access before rendering its content.

## 22. Tenant-safe query design

**WHAT?** Queries include validated parent scope and only return allowlisted DTOs.

**WHY?** A scoped endpoint with an unscoped subordinate lookup can still leak or mutate another tenant.

**HOW?** Filter memberships/invitations by organization and workspace, use bounded pages and batch user projections.

**REAL CODE EXAMPLE?** [backend/src/modules/organizations/tenant.service.ts](../backend/src/modules/organizations/tenant.service.ts):

```ts
    const rows = await models.Workspace.find({
      organizationId: { $in: ids },
      $or: [
```

**INTERVIEW ANSWER?** I audit each database predicate and reference relationship, not just route middleware.

## 23. Frontend versus backend authorization

**WHAT?** Frontend permission checks hide unavailable actions; backend checks decide authority.

**WHY?** Users can send requests without using the UI.

**HOW?** Render actions using safe permissions, then independently enforce current capabilities on the server.

**REAL CODE EXAMPLE?** [frontend/src/features/team/tenant-team.tsx](../frontend/src/features/team/tenant-team.tsx):

```ts
  const canManage = permissions.includes(`${permission}.members.manage`),
    canInvite = permissions.includes(`${permission}.invitations.manage`),
    canManageAdmins = role === 'OWNER'
```

**INTERVIEW ANSWER?** The frontend helps the user; only the backend establishes a security boundary.

## 24. Session and membership changes

**WHAT?** Identity sessions and tenant memberships have separate lifecycles.

**WHY?** A role change must take effect before an old access JWT expires.

**HOW?** Every request checks current database user/session and membership; writes lock the auth epoch and company guard.

**REAL CODE EXAMPLE?** [backend/src/modules/organizations/tenant.service.ts](../backend/src/modules/organizations/tenant.service.ts):

```ts
              authVersion: actor.version,
              accountStatus: 'active',
              emailVerifiedAt: { $ne: null },
```

**INTERVIEW ANSWER?** JWT authentication remains short-lived, while database checks provide immediate session and membership revocation.

## 25. Scaling multi-tenant applications

**WHAT?** Growth increases tenant counts, membership fan-out and contention.

**WHY?** Unbounded lists and global lookups can become isolation and availability problems.

**HOW?** Bound product limits, use stable cursors and indexes, batch member lookups, then measure before adding caching or queues.

**REAL CODE EXAMPLE?** [backend/src/modules/organizations/tenant.schema.ts](../backend/src/modules/organizations/tenant.schema.ts):

```ts
export const pageSchema = z.strictObject({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: idSchema.optional(),
```

**INTERVIEW ANSWER?** I start with measurable bounded queries and make future optimizations preserve the same tenant boundary.

## Demonstration and honest limits

Use only controlled isolated accounts and the [manual setup procedure](phase-5-multi-tenant-architecture.md#safe-rollout-and-reproducible-demonstration). Demonstrate company creation, two-company switching, invite acceptance, VIEWER denial, immediate removal and cross-tenant 404. Do not seed Atlas examples. Ownership transfer, durable mail outbox and Phase 6 domain modules are deferred. Live schema/auth acceptance remains pending private credential rotation.
