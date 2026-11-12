import { Types, type ClientSession, type Connection, type InferSchemaType } from 'mongoose'
import type { Logger } from 'pino'
import type { AuthContext } from '../auth/auth.service.js'
import type { AuthModels } from '../auth/auth.models.js'
import type { MailAdapter } from '../../lib/mail.js'
import { ApiError } from '../../lib/api-error.js'
import { randomToken, tokenHash, unauthorized } from '../auth/auth.crypto.js'
import { createTenantRepository } from './tenant.repository.js'
import type { TenantModels } from './tenant.models.js'
import type { organizationSchema } from './organization.model.js'
import type { workspaceSchema } from '../workspaces/workspace.model.js'
import {
  permissionMatrix,
  workspacePermissionMatrix,
  type Permission,
} from '../memberships/permissions.js'
import type { OrganizationRole, WorkspaceRole } from '../memberships/membership.models.js'
import type {
  CreateOrganization,
  CreateWorkspace,
  InviteInput,
  PageInput,
} from './tenant.schema.js'

const hidden = () => new ApiError(404, 'NOT_FOUND', 'This resource is unavailable.')
const forbidden = () =>
  new ApiError(403, 'FORBIDDEN', 'You do not have permission for this action.')
const conflict = (message = 'This change conflicts with current data. Refresh and try again.') =>
  new ApiError(409, 'CONFLICT', message)
const invalidInvite = () =>
  new ApiError(
    410,
    'INVITATION_UNAVAILABLE',
    'This invitation is invalid, expired, revoked or already accepted.',
  )
type Org = InferSchemaType<typeof organizationSchema> & { _id: Types.ObjectId }
type Workspace = InferSchemaType<typeof workspaceSchema> & { _id: Types.ObjectId }
const organizationDto = (row: Org) => ({
  id: String(row._id),
  name: row.name,
  slug: row.normalizedSlug,
  description: row.description,
  website: row.website,
  industry: row.industry,
  status: row.status,
  version: row.revision,
})
const workspaceDto = (row: Workspace) => ({
  id: String(row._id),
  organizationId: String(row.organizationId),
  name: row.name,
  slug: row.normalizedSlug,
  description: row.description,
  status: row.status,
  version: row.revision,
})
function page<T extends { _id: unknown }>(rows: T[], input: PageInput, map: (row: T) => unknown) {
  const hasMore = rows.length > input.limit,
    selected = rows.slice(0, input.limit)
  return {
    items: selected.map(map),
    nextCursor: hasMore ? String(selected.at(-1)!._id) : null,
    hasMore,
  }
}
const cursor = (input: PageInput) =>
  input.cursor ? { _id: { $gt: new Types.ObjectId(input.cursor) } } : {}

export function createTenantService({
  models,
  authModels,
  connection,
  mail,
  logger,
  webOrigin,
  now = () => new Date(),
}: {
  models: TenantModels
  authModels: AuthModels
  connection: Connection
  mail: MailAdapter
  logger: Logger
  webOrigin: string
  now?: () => Date
}) {
  const repository = createTenantRepository(models)
  const pendingMail = new Set<Promise<void>>()
  async function write<T>(
    actor: AuthContext,
    operation: (session: ClientSession) => Promise<T>,
  ): Promise<T> {
    const session = await connection.startSession()
    try {
      return await session.withTransaction(
        async () => {
          const user = await authModels.User.findOneAndUpdate(
            {
              _id: actor.userId,
              authVersion: actor.version,
              accountStatus: 'active',
              emailVerifiedAt: { $ne: null },
            },
            { $inc: { authLock: 1 } },
            { session },
          )
          const active = await authModels.Session.findOneAndUpdate(
            {
              _id: actor.sessionId,
              userId: actor.userId,
              authVersion: actor.version,
              revokedAt: null,
              expiresAt: { $gt: now() },
              absoluteExpiresAt: { $gt: now() },
            },
            { $inc: { __v: 1 } },
            { session },
          ).select('_id')
          if (!user || !active) throw unauthorized()
          return await operation(session)
        },
        {
          readConcern: { level: 'snapshot' },
          writeConcern: { w: 'majority' },
          maxCommitTimeMS: 5000,
        },
      )
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 11000)
        throw conflict('The slug, membership, creation key or pending invitation already exists.')
      throw error
    } finally {
      await session.endSession()
    }
  }
  async function authorize(
    actor: AuthContext,
    organizationId: string,
    workspaceId?: string,
    permission: Permission = 'organization.read',
    session?: ClientSession,
  ) {
    // Keep session-bound operations sequential; a transaction uses one connection.
    const organization = await repository.organization(organizationId, session)
    const member = await repository.organizationMembership(organizationId, actor.userId, session)
    if (!organization || !member) throw hidden()
    const organizationRole = member.role as OrganizationRole
    if (organization.status !== 'active' && organizationRole === 'MEMBER') throw hidden()
    const base = { organization, organizationRole }
    if (!workspaceId) {
      if (!permissionMatrix[organizationRole]?.includes(permission)) throw forbidden()
      return {
        ...base,
        workspace: undefined,
        workspaceRole: undefined,
        actualWorkspaceRole: undefined,
        permissions: permissionMatrix[organizationRole],
      }
    }
    const workspace = await repository.workspace(organizationId, workspaceId, session)
    const workspaceMember = await repository.workspaceMembership(
      organizationId,
      workspaceId,
      actor.userId,
      session,
    )
    if (!workspace) throw hidden()
    const actualWorkspaceRole = workspaceMember?.role as WorkspaceRole | undefined
    const workspaceRole: WorkspaceRole | undefined =
      organizationRole === 'OWNER'
        ? 'OWNER'
        : organizationRole === 'ADMIN'
          ? actualWorkspaceRole === 'OWNER'
            ? 'OWNER'
            : 'ADMIN'
          : actualWorkspaceRole
    if (
      !workspaceRole ||
      (workspace.status !== 'active' && !['OWNER', 'ADMIN'].includes(workspaceRole))
    )
      throw hidden()
    const permissions = [
      ...new Set([
        ...permissionMatrix[organizationRole],
        ...workspacePermissionMatrix[workspaceRole],
      ]),
    ]
    if (!permissions.includes(permission)) throw forbidden()
    return { ...base, workspace, workspaceRole, actualWorkspaceRole, permissions }
  }
  async function guardOrganization(
    organizationId: string,
    session: ClientSession,
    activeOnly = true,
  ) {
    const row = await models.Organization.findOneAndUpdate(
      { _id: organizationId, ...(activeOnly ? { status: 'active' } : {}) },
      { $inc: { revision: 1 } },
      { session, returnDocument: 'after' },
    )
    if (!row) throw hidden()
    return row
  }
  async function createOrganization(actor: AuthContext, input: CreateOrganization) {
    const digest = tokenHash(JSON.stringify(input))
    return write(actor, async (session) => {
      const existing = await models.Organization.findOne({
        ownerUserId: actor.userId,
        creationKey: input.creationKey,
      })
        .select('+requestDigest')
        .session(session)
      if (existing) {
        if (existing.requestDigest !== digest)
          throw conflict('This creation key was already used with different details.')
        const workspace = await models.Workspace.findOne({ organizationId: existing._id })
          .sort({ createdAt: 1 })
          .session(session)
        if (!workspace) throw conflict()
        return { organization: organizationDto(existing), workspace: workspaceDto(workspace) }
      }
      if (
        (await models.Organization.countDocuments({ ownerUserId: actor.userId }).session(
          session,
        )) >= 10 ||
        (await models.OrganizationMembership.countDocuments({
          userId: actor.userId,
          status: 'active',
        }).session(session)) >= 100
      )
        throw conflict('The company membership limit was reached.')
      const organizationId = new Types.ObjectId(),
        workspaceId = new Types.ObjectId()
      const [organization] = await models.Organization.create(
        [
          {
            _id: organizationId,
            name: input.name,
            normalizedSlug: input.slug,
            description: input.description,
            website: input.website,
            industry: input.industry,
            ownerUserId: actor.userId,
            creationKey: input.creationKey,
            requestDigest: digest,
          },
        ],
        { session },
      )
      const [workspace] = await models.Workspace.create(
        [
          {
            _id: workspaceId,
            organizationId,
            name: input.workspaceName,
            normalizedSlug: input.workspaceSlug,
            createdBy: actor.userId,
            creationKey: input.creationKey,
            requestDigest: digest,
          },
        ],
        { session },
      )
      await models.OrganizationMembership.create(
        [{ organizationId, userId: actor.userId, role: 'OWNER' }],
        { session },
      )
      await models.WorkspaceMembership.create(
        [{ organizationId, workspaceId, userId: actor.userId, role: 'OWNER' }],
        { session },
      )
      return { organization: organizationDto(organization!), workspace: workspaceDto(workspace!) }
    })
  }
  async function organizations(actor: AuthContext, input: PageInput) {
    const memberships = await models.OrganizationMembership.find({
      userId: actor.userId,
      status: 'active',
      ...cursor(input),
    })
      .sort({ _id: 1 })
      .limit(input.limit + 1)
    const rows = await models.Organization.find({
      _id: { $in: memberships.map((row) => row.organizationId) },
    })
    const byId = new Map(rows.map((row) => [String(row._id), row]))
    const result = page(memberships, input, (member) => {
      const row = byId.get(String(member.organizationId))
      return row && (row.status === 'active' || member.role !== 'MEMBER')
        ? { ...organizationDto(row), role: member.role }
        : null
    })
    return { ...result, items: result.items.filter(Boolean) }
  }
  async function workspaces(actor: AuthContext, input: PageInput, organizationId?: string) {
    if (organizationId) await authorize(actor, organizationId)
    const memberships = await models.OrganizationMembership.find({
      userId: actor.userId,
      status: 'active',
      ...(organizationId ? { organizationId } : {}),
    }).limit(100)
    const orgs = await models.Organization.find({
      _id: { $in: memberships.map((row) => row.organizationId) },
      $or: [
        { status: 'active' },
        {
          _id: {
            $in: memberships
              .filter((row) => row.role !== 'MEMBER')
              .map((row) => row.organizationId),
          },
        },
      ],
    })
    const ids = orgs.map((row) => row._id),
      allowed = new Set(ids.map(String))
    const visibleMembers = memberships.filter((row) => allowed.has(String(row.organizationId)))
    const adminIds = visibleMembers
      .filter((row) => row.role === 'OWNER' || row.role === 'ADMIN')
      .map((row) => row.organizationId)
    const workspaceMembers = await models.WorkspaceMembership.find({
      userId: actor.userId,
      organizationId: { $in: ids },
      status: 'active',
    }).limit(2000)
    const rows = await models.Workspace.find({
      organizationId: { $in: ids },
      $or: [
        { organizationId: { $in: adminIds } },
        {
          _id: {
            $in: workspaceMembers
              .filter((row) => row.role === 'OWNER' || row.role === 'ADMIN')
              .map((row) => row.workspaceId),
          },
        },
        { status: 'active', _id: { $in: workspaceMembers.map((row) => row.workspaceId) } },
      ],
      ...cursor(input),
    })
      .sort({ _id: 1 })
      .limit(input.limit + 1)
    return page(rows, input, (row) => ({
      ...workspaceDto(row),
      organizationName: orgs.find((org) => String(org._id) === String(row.organizationId))?.name,
      role:
        visibleMembers.find(
          (member) => String(member.organizationId) === String(row.organizationId),
        )?.role === 'OWNER'
          ? 'OWNER'
          : workspaceMembers.find((member) => String(member.workspaceId) === String(row._id))
                ?.role === 'OWNER'
            ? 'OWNER'
            : adminIds.some((id) => String(id) === String(row.organizationId))
              ? 'ADMIN'
              : workspaceMembers.find((member) => String(member.workspaceId) === String(row._id))
                  ?.role,
    }))
  }
  async function overview(actor: AuthContext, workspaceId: string) {
    // Workspace lookup derives its parent only; membership then authorizes both identifiers.
    const parent = await models.Workspace.findOne({ _id: workspaceId }).select('organizationId')
    if (!parent) throw hidden()
    const context = await authorize(
      actor,
      String(parent.organizationId),
      workspaceId,
      'workspace.read',
    )
    const [memberCount, pendingInvitations] = await Promise.all([
      models.WorkspaceMembership.countDocuments({
        organizationId: context.organization._id,
        workspaceId,
        status: 'active',
      }),
      context.permissions.includes('workspace.invitations.manage')
        ? models.Invitation.countDocuments({
            organizationId: context.organization._id,
            'targets.workspaceId': workspaceId,
            status: 'pending',
            expiresAt: { $gt: now() },
          })
        : Promise.resolve(null),
    ])
    return {
      organization: organizationDto(context.organization),
      workspace: workspaceDto(context.workspace!),
      organizationRole: context.organizationRole,
      role: context.workspaceRole,
      permissions: context.permissions,
      memberCount,
      pendingInvitations,
    }
  }
  async function organization(actor: AuthContext, organizationId: string) {
    const context = await authorize(actor, organizationId)
    return {
      ...organizationDto(context.organization),
      role: context.organizationRole,
      permissions: context.permissions,
    }
  }
  async function createWorkspace(
    actor: AuthContext,
    organizationId: string,
    input: CreateWorkspace,
  ) {
    return write(actor, async (session) => {
      await authorize(actor, organizationId, undefined, 'workspace.create', session)
      await guardOrganization(organizationId, session)
      const digest = tokenHash(JSON.stringify(input))
      const existing = await models.Workspace.findOne({
        organizationId,
        createdBy: actor.userId,
        creationKey: input.creationKey,
      })
        .select('+requestDigest')
        .session(session)
      if (existing) {
        if (existing.requestDigest !== digest) throw conflict()
        return workspaceDto(existing)
      }
      if ((await models.Workspace.countDocuments({ organizationId }).session(session)) >= 20)
        throw conflict('The current limit is twenty workspaces per company.')
      const [workspace] = await models.Workspace.create(
        [
          {
            organizationId,
            name: input.name,
            normalizedSlug: input.slug,
            description: input.description,
            createdBy: actor.userId,
            creationKey: input.creationKey,
            requestDigest: digest,
          },
        ],
        { session },
      )
      await models.WorkspaceMembership.create(
        [{ organizationId, workspaceId: workspace!._id, userId: actor.userId, role: 'OWNER' }],
        { session },
      )
      return workspaceDto(workspace!)
    })
  }
  async function updateOrganization(
    actor: AuthContext,
    organizationId: string,
    input: {
      name?: string | undefined
      description?: string | undefined
      website?: string | undefined
      industry?: string | undefined
      status?: string | undefined
      version: number
    },
  ) {
    return write(actor, async (session) => {
      const context = await authorize(
        actor,
        organizationId,
        undefined,
        'organization.update',
        session,
      )
      if (input.status && context.organizationRole !== 'OWNER') throw forbidden()
      if (context.organization.revision !== input.version) throw conflict()
      await guardOrganization(organizationId, session, false)
      const updates = Object.fromEntries(Object.entries(input).filter(([key]) => key !== 'version'))
      const row = await models.Organization.findOneAndUpdate(
        { _id: organizationId, revision: input.version + 1 },
        { $set: updates },
        { session, returnDocument: 'after', runValidators: true },
      )
      if (!row) throw conflict()
      return organizationDto(row)
    })
  }
  async function updateWorkspace(
    actor: AuthContext,
    workspaceId: string,
    input: {
      name?: string | undefined
      slug?: string | undefined
      description?: string | undefined
      status?: string | undefined
      version: number
    },
  ) {
    return write(actor, async (session) => {
      const parent = await models.Workspace.findOne({ _id: workspaceId })
        .select('organizationId')
        .session(session)
      if (!parent) throw hidden()
      const organizationId = String(parent.organizationId)
      await authorize(actor, organizationId, workspaceId, 'workspace.update', session)
      await guardOrganization(organizationId, session)
      const { version, slug, ...updates } = input
      const row = await models.Workspace.findOneAndUpdate(
        { _id: workspaceId, organizationId, revision: version },
        { $set: { ...updates, ...(slug ? { normalizedSlug: slug } : {}) }, $inc: { revision: 1 } },
        { session, returnDocument: 'after', runValidators: true },
      )
      if (!row) throw conflict()
      return workspaceDto(row)
    })
  }
  async function members(
    actor: AuthContext,
    organizationId: string,
    workspaceId: string | undefined,
    input: PageInput,
  ) {
    await authorize(
      actor,
      organizationId,
      workspaceId,
      workspaceId ? 'workspace.members.read' : 'organization.members.read',
    )
    const filter = {
      organizationId,
      ...(workspaceId ? { workspaceId } : {}),
      status: 'active',
      ...cursor(input),
    }
    const rows = workspaceId
      ? await models.WorkspaceMembership.find(filter)
          .sort({ _id: 1 })
          .limit(input.limit + 1)
      : await models.OrganizationMembership.find(filter)
          .sort({ _id: 1 })
          .limit(input.limit + 1)
    const users = await authModels.User.find({
      _id: { $in: rows.map((row) => row.userId) },
    }).select('name email avatarUrl accountStatus')
    const records = rows.map((row) => {
      const user = users.find((user) => String(user._id) === String(row.userId))
      return {
        _id: row._id,
        member: {
          id: String(row._id),
          userId: String(row.userId),
          name: user?.name ?? 'Unavailable account',
          email: user?.email ?? '',
          role: row.role,
          status: row.status,
          joinedAt: row.joinedAt?.toISOString(),
          accountStatus: user?.accountStatus,
        },
      }
    })
    return page(records, input, (row) => row.member)
  }
  async function mutateMember(
    actor: AuthContext,
    organizationId: string,
    workspaceId: string | undefined,
    memberId: string,
    role?: string,
  ) {
    return write(actor, async (session) => {
      const context = await authorize(
        actor,
        organizationId,
        workspaceId,
        workspaceId ? 'workspace.members.manage' : 'organization.members.manage',
        session,
      )
      await guardOrganization(organizationId, session)
      const filter = {
        _id: memberId,
        organizationId,
        ...(workspaceId ? { workspaceId } : {}),
        status: 'active',
      }
      const member = workspaceId
        ? await models.WorkspaceMembership.findOne(filter).session(session)
        : await models.OrganizationMembership.findOne(filter).session(session)
      if (!member) throw hidden()
      if (member.role === 'OWNER')
        throw conflict(
          'Founding ownership is protected. Ownership transfer is not available in Phase 5.',
        )
      if (String(member.userId) === actor.userId) throw forbidden()
      const canManageAdmins =
        context.organizationRole === 'OWNER' ||
        (workspaceId && context.actualWorkspaceRole === 'OWNER')
      if (!canManageAdmins && (member.role === 'ADMIN' || role === 'ADMIN')) throw forbidden()
      if (
        !workspaceId &&
        !role &&
        (await models.WorkspaceMembership.exists({
          organizationId,
          userId: member.userId,
          role: 'OWNER',
          status: 'active',
        }).session(session))
      )
        throw conflict('A workspace owner must retain company membership.')
      const updates = role ? { role } : { status: 'revoked' }
      if (workspaceId)
        await models.WorkspaceMembership.updateOne(
          filter,
          { $set: updates },
          { session, runValidators: true },
        )
      else {
        await models.OrganizationMembership.updateOne(
          filter,
          { $set: updates },
          { session, runValidators: true },
        )
        if (!role)
          await models.WorkspaceMembership.updateMany(
            { organizationId, userId: member.userId, status: 'active' },
            { $set: { status: 'revoked' } },
            { session },
          )
      }
      return { updated: true }
    })
  }
  async function assignable(
    actor: AuthContext,
    organizationId: string,
    input: InviteInput,
    session: ClientSession,
  ) {
    const org = await authorize(actor, organizationId, undefined, 'organization.read', session)
    if (input.organizationRole === 'ADMIN' && org.organizationRole !== 'OWNER') throw forbidden()
    for (const target of input.targets) {
      const scope = await authorize(
        actor,
        organizationId,
        target.workspaceId,
        'workspace.invitations.manage',
        session,
      )
      if (
        target.role === 'ADMIN' &&
        scope.organizationRole !== 'OWNER' &&
        scope.actualWorkspaceRole !== 'OWNER'
      )
        throw forbidden()
      if (scope.workspace?.status !== 'active')
        throw conflict('Archived workspaces cannot receive invitations.')
    }
    return org
  }
  const invitationDto = (row: Awaited<ReturnType<typeof models.Invitation.findOne>> & {}) => ({
    id: String(row._id),
    organizationId: String(row.organizationId),
    email: row.invitedEmailNormalized,
    organizationRole: row.intendedOrganizationRole,
    targets: row.targets.map((target) => ({
      workspaceId: String(target.workspaceId),
      role: target.role,
    })),
    status: row.status === 'pending' && +row.expiresAt <= +now() ? 'expired' : row.status,
    expiresAt: row.expiresAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
  })
  function dispatchInvitation(
    email: string,
    token: string,
    context: {
      organizationName: string
      workspaceNames: string[]
      roles: string[]
      inviterName: string
      expiresAt: string
      message: string
    },
  ) {
    const task = mail
      .send({
        to: email,
        purpose: 'invitation',
        link: `${webOrigin}/app/invitations#token=${token}`,
        context,
      })
      .catch(() => {
        logger.error(
          { errorCode: 'INVITATION_MAIL_FAILED' },
          'Invitation mail dispatch failed; use authorized resend',
        )
      })
    pendingMail.add(task)
    void task.finally(() => pendingMail.delete(task))
  }
  async function invite(actor: AuthContext, organizationId: string, input: InviteInput) {
    const token = randomToken(),
      date = now()
    const result = await write(actor, async (session) => {
      const context = await assignable(actor, organizationId, input, session)
      await guardOrganization(organizationId, session)
      await models.Invitation.updateMany(
        {
          organizationId,
          invitedEmailNormalized: input.email,
          status: 'pending',
          expiresAt: { $lte: date },
        },
        { $set: { status: 'expired' } },
        { session },
      )
      if (
        (await models.Invitation.countDocuments({ organizationId, status: 'pending' }).session(
          session,
        )) >= 1000
      )
        throw conflict('The pending invitation limit was reached.')
      const [row] = await models.Invitation.create(
        [
          {
            organizationId,
            invitedEmailNormalized: input.email,
            intendedOrganizationRole: input.organizationRole,
            targets: input.targets,
            invitedByUserId: actor.userId,
            tokenHash: tokenHash(token),
            expiresAt: new Date(+date + 72 * 3600000),
            lastSentAt: date,
            purgeAt: new Date(+date + 90 * 86400000),
            message: input.message,
          },
        ],
        { session },
      )
      const workspaces = await models.Workspace.find({
        organizationId,
        _id: { $in: input.targets.map((target) => target.workspaceId) },
      }).session(session)
      return {
        dto: invitationDto(row!),
        organizationName: context.organization.name,
        workspaceNames: workspaces.map((row) => row.name),
      }
    })
    dispatchInvitation(input.email, token, {
      organizationName: result.organizationName,
      workspaceNames: result.workspaceNames,
      roles: input.targets.map((target) => target.role),
      inviterName: actor.user.name,
      expiresAt: result.dto.expiresAt,
      message: input.message,
    })
    return result.dto
  }
  async function invitations(
    actor: AuthContext,
    organizationId: string,
    input: PageInput,
    workspaceId?: string,
  ) {
    await authorize(
      actor,
      organizationId,
      workspaceId,
      workspaceId ? 'workspace.invitations.manage' : 'organization.invitations.manage',
    )
    const rows = await models.Invitation.find({
      organizationId,
      ...(workspaceId ? { 'targets.workspaceId': workspaceId, targets: { $size: 1 } } : {}),
      ...cursor(input),
    })
      .sort({ _id: 1 })
      .limit(input.limit + 1)
    return page(rows, input, invitationDto)
  }
  async function manageInvitation(
    actor: AuthContext,
    organizationId: string,
    invitationId: string,
    resend: boolean,
  ) {
    const token = randomToken()
    const result = await write(actor, async (session) => {
      const row = await models.Invitation.findOne({
        _id: invitationId,
        organizationId,
        status: 'pending',
      }).session(session)
      if (!row) throw hidden()
      const input: InviteInput = {
        email: row.invitedEmailNormalized,
        organizationRole: row.intendedOrganizationRole as 'ADMIN' | 'MEMBER',
        targets: row.targets.map((target) => ({
          workspaceId: String(target.workspaceId),
          role: target.role as InviteInput['targets'][number]['role'],
        })),
        message: row.message,
      }
      const context = await assignable(actor, organizationId, input, session)
      await guardOrganization(organizationId, session)
      if (resend && +row.lastSentAt > +now() - 60000)
        throw new ApiError(429, 'RATE_LIMITED', 'Wait one minute before resending.')
      if (+row.expiresAt <= +now()) throw invalidInvite()
      const update = resend
        ? {
            tokenHash: tokenHash(token),
            invitedByUserId: actor.userId,
            lastSentAt: now(),
            expiresAt: new Date(+now() + 72 * 3600000),
            purgeAt: new Date(+now() + 90 * 86400000),
          }
        : { status: 'revoked', revokedAt: now() }
      const changed = await models.Invitation.findOneAndUpdate(
        { _id: invitationId, organizationId, status: 'pending' },
        { $set: update },
        { session, returnDocument: 'after' },
      )
      const workspaces = await models.Workspace.find({
        organizationId,
        _id: { $in: input.targets.map((target) => target.workspaceId) },
      }).session(session)
      return {
        dto: invitationDto(changed!),
        input,
        organizationName: context.organization.name,
        workspaceNames: workspaces.map((row) => row.name),
      }
    })
    if (resend)
      dispatchInvitation(result.input.email, token, {
        organizationName: result.organizationName,
        workspaceNames: result.workspaceNames,
        roles: result.input.targets.map((target) => target.role),
        inviterName: actor.user.name,
        expiresAt: result.dto.expiresAt,
        message: result.input.message,
      })
    return result.dto
  }
  async function preview(token: string) {
    const row = await models.Invitation.findOne({
      tokenHash: tokenHash(token),
      status: 'pending',
      expiresAt: { $gt: now() },
    })
    if (!row) throw invalidInvite()
    const organization = await models.Organization.findOne({
      _id: row.organizationId,
      status: 'active',
    })
    const workspaces = await models.Workspace.find({
      organizationId: row.organizationId,
      _id: { $in: row.targets.map((target) => target.workspaceId) },
      status: 'active',
    })
    if (!organization || workspaces.length !== row.targets.length) throw invalidInvite()
    return {
      organizationName: organization.name,
      workspaces: workspaces.map((workspace) => ({
        name: workspace.name,
        role: row.targets.find((target) => String(target.workspaceId) === String(workspace._id))
          ?.role,
      })),
      organizationRole: row.intendedOrganizationRole,
      expiresAt: row.expiresAt.toISOString(),
    }
  }
  async function accept(actor: AuthContext, token: string) {
    return write(actor, async (session) => {
      const row = await models.Invitation.findOne({
        tokenHash: tokenHash(token),
        status: 'pending',
        expiresAt: { $gt: now() },
      }).session(session)
      if (!row) throw invalidInvite()
      const user = await authModels.User.findById(actor.userId).session(session)
      if (!user || !user.emailVerifiedAt || user.normalizedEmail !== row.invitedEmailNormalized)
        throw forbidden()
      const organizationId = String(row.organizationId)
      await guardOrganization(organizationId, session)
      const inviter = await authModels.User.findOneAndUpdate(
        {
          _id: row.invitedByUserId,
          accountStatus: 'active',
          emailVerifiedAt: { $ne: null },
        },
        { $inc: { authLock: 1 } },
        { session },
      )
      if (!inviter) throw invalidInvite()
      await assignable(
        { ...actor, userId: String(inviter._id) },
        organizationId,
        {
          email: row.invitedEmailNormalized,
          organizationRole: row.intendedOrganizationRole as 'ADMIN' | 'MEMBER',
          targets: row.targets.map((target) => ({
            workspaceId: String(target.workspaceId),
            role: target.role as InviteInput['targets'][number]['role'],
          })),
          message: row.message,
        },
        session,
      )
      const orgMember = await models.OrganizationMembership.findOne({
        organizationId,
        userId: actor.userId,
      }).session(session)
      if (
        orgMember?.status !== 'active' &&
        ((await models.OrganizationMembership.countDocuments({
          userId: actor.userId,
          status: 'active',
        }).session(session)) >= 100 ||
          (await models.OrganizationMembership.countDocuments({
            organizationId,
            status: 'active',
          }).session(session)) >= 1000)
      )
        throw conflict('Membership limit reached.')
      if (!orgMember)
        await models.OrganizationMembership.create(
          [{ organizationId, userId: actor.userId, role: row.intendedOrganizationRole }],
          { session },
        )
      else if (orgMember.status !== 'active')
        await models.OrganizationMembership.updateOne(
          { _id: orgMember._id, organizationId },
          { $set: { status: 'active', role: row.intendedOrganizationRole, joinedAt: now() } },
          { session },
        )
      for (const target of row.targets) {
        const workspaceId = String(target.workspaceId)
        if (!(await repository.workspace(organizationId, workspaceId, session)))
          throw invalidInvite()
        const member = await models.WorkspaceMembership.findOne({
          organizationId,
          workspaceId,
          userId: actor.userId,
        }).session(session)
        if (!member)
          await models.WorkspaceMembership.create(
            [{ organizationId, workspaceId, userId: actor.userId, role: target.role }],
            { session },
          )
        else if (member.status !== 'active')
          await models.WorkspaceMembership.updateOne(
            { _id: member._id, organizationId, workspaceId },
            { $set: { status: 'active', role: target.role, joinedAt: now() } },
            { session },
          )
      }
      await models.Invitation.updateOne(
        { _id: row._id, organizationId, status: 'pending' },
        { $set: { status: 'accepted', acceptedAt: now() } },
        { session },
      )
      return { organizationId, workspaceId: String(row.targets[0]!.workspaceId) }
    })
  }
  async function workspaceContext(
    actor: AuthContext,
    workspaceId: string,
    permission: Permission = 'workspace.read',
  ) {
    const parent = await models.Workspace.findOne({ _id: workspaceId }).select('organizationId')
    if (!parent) throw hidden()
    return authorize(actor, String(parent.organizationId), workspaceId, permission)
  }
  return {
    createOrganization,
    organizations,
    organization,
    workspaces,
    overview,
    createWorkspace,
    updateOrganization,
    updateWorkspace,
    members,
    mutateMember,
    invite,
    invitations,
    manageInvitation,
    preview,
    accept,
    authorize,
    workspaceContext,
    drainMail: () => Promise.all([...pendingMail]).then(() => undefined),
  }
}
export type TenantService = ReturnType<typeof createTenantService>
