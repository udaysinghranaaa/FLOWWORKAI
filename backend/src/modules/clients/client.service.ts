import { Types, type ClientSession } from 'mongoose'
import type { Logger } from 'pino'
import type { AuthContext } from '../auth/auth.service.js'
import type { AuthModels } from '../auth/auth.models.js'
import { randomToken, tokenHash } from '../auth/auth.crypto.js'
import type { TenantService } from '../organizations/tenant.service.js'
import type { TenantModels } from '../organizations/tenant.models.js'
import type { WorkService } from '../work-management/work.service.js'
import type { WorkModels } from '../work-management/work.models.js'
import type { MailAdapter } from '../../lib/mail.js'
import { ApiError } from '../../lib/api-error.js'
import type { ClientModels, ResourceRecord } from './client.models.js'
import type * as S from './client.schema.js'
import { statuses, kinds } from './client.schema.js'
import type { z } from 'zod'
const hidden = () => new ApiError(404, 'NOT_FOUND', 'This resource is unavailable.')
const denied = () => new ApiError(403, 'FORBIDDEN', 'You do not have permission for this action.')
const conflict = () =>
  new ApiError(
    409,
    'CONFLICT',
    'This record changed or the action conflicts with its current state. Refresh and try again.',
  )
const expired = () =>
  new ApiError(410, 'INVITATION_UNAVAILABLE', 'This invitation is unavailable or expired.')
const scopeOf = (c: {
  organizationId: Types.ObjectId
  workspaceId: Types.ObjectId
  _id: Types.ObjectId
}) => ({ organizationId: c.organizationId, workspaceId: c.workspaceId, clientId: c._id })
const oid = (v: string) => new Types.ObjectId(v)
// Zod optional values are normalized before strict Mongoose create contracts.
function defined<T extends object>(value: T): { [K in keyof T]: Exclude<T[K], undefined> } {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as {
    [K in keyof T]: Exclude<T[K], undefined>
  }
}
const checkVersion = (row: { version: number }, version: number) => {
  if (row.version !== version) throw conflict()
}
const pageFilter = (q: S.Query) =>
  q.cursor ? { _id: { [q.sort === 'newest' ? '$lt' : '$gt']: oid(q.cursor) } } : {}
function page<T extends { _id: Types.ObjectId }>(rows: T[], q: S.Query, map: (r: T) => unknown) {
  const selected = rows.slice(0, q.limit)
  return {
    items: selected.map(map),
    hasMore: rows.length > q.limit,
    nextCursor: rows.length > q.limit ? String(selected.at(-1)!._id) : null,
  }
}
const baseDto = (r: { _id: Types.ObjectId; version: number }) => ({
  id: String(r._id),
  version: r.version,
})
const resourceDto = (r: ResourceRecord & { _id: Types.ObjectId }, internal = false) => ({
  ...baseDto(r),
  kind: r.kind,
  title: r.title,
  body: r.body,
  status: r.status,
  published: r.published,
  progress: r.progress,
  dueDate: r.dueDate,
  position: r.position,
  priority: r.priority,
  parentId: r.parentId ? String(r.parentId) : null,
  url: r.url,
  fileName: r.fileName,
  contentType: r.contentType,
  size: r.size,
  revision: r.revision,
  previousId: r.previousId ? String(r.previousId) : null,
  decisionAt: r.decisionAt?.toISOString() ?? null,
  decisionNote: r.decisionNote,
  publishedAt: r.publishedAt?.toISOString() ?? null,
  createdAt: r.createdAt.toISOString(),
  ...(internal
    ? {
        taskId: r.taskId ? String(r.taskId) : null,
        createdBy: String(r.createdBy),
        decisionBy: r.decisionBy ? String(r.decisionBy) : null,
      }
    : {}),
})
const permissions = {
  progress: 'progress',
  milestone: 'milestones',
  deliverable: 'deliverables',
  feedback: 'feedback',
  reply: 'feedback',
  change: 'changes',
} as const
const transitions: Record<string, Record<string, string[]>> = {
  progress: {
    draft: ['published', 'archived'],
    published: ['superseded', 'archived'],
    superseded: ['archived'],
    archived: [],
  },
  milestone: {
    planned: ['in_progress', 'completed', 'delayed', 'archived'],
    in_progress: ['planned', 'completed', 'delayed', 'archived'],
    completed: ['in_progress', 'archived'],
    delayed: ['in_progress', 'completed', 'archived'],
    archived: [],
  },
  feedback: {
    open: ['acknowledged', 'resolved', 'closed'],
    acknowledged: ['resolved', 'closed'],
    resolved: ['open', 'closed'],
    closed: [],
  },
  change: {
    submitted: ['under_review'],
    under_review: ['approved', 'rejected'],
    approved: ['completed'],
    rejected: [],
    completed: [],
  },
  deliverable: {
    draft: ['shared', 'archived'],
    shared: ['approved', 'changes_requested', 'superseded', 'archived'],
    approved: ['superseded', 'archived'],
    changes_requested: ['superseded', 'archived'],
    superseded: ['archived'],
    archived: [],
  },
  reply: { open: [] },
}
export function createClientService({
  models,
  tenants,
  tenantModels,
  work,
  workModels,
  authModels,
  mail,
  logger,
  webOrigin,
  now = () => new Date(),
}: {
  models: ClientModels
  tenants: TenantService
  tenantModels: TenantModels
  work: WorkService
  workModels: WorkModels
  authModels: AuthModels
  mail: MailAdapter
  logger: Logger
  webOrigin: string
  now?: () => Date
}) {
  const pending = new Set<Promise<void>>()
  async function internal(a: AuthContext, ws: string, session?: ClientSession, admin = true) {
    const s = await tenants.workspaceContext(a, ws, 'workspace.read', session)
    if (s.organization.status !== 'active' || s.workspace?.status !== 'active') throw hidden()
    if (admin && !['OWNER', 'ADMIN'].includes(s.workspaceRole!)) throw denied()
    return s
  }
  async function client(
    a: AuthContext,
    ws: string,
    id: string,
    session?: ClientSession,
    admin = true,
  ) {
    const s = await internal(a, ws, session, admin)
    const c = await models.Client.findOne({
      _id: id,
      workspaceId: ws,
      organizationId: s.organization._id,
    }).session(session ?? null)
    if (!c) throw hidden()
    return c
  }
  async function portal(a: AuthContext, id: string, session?: ClientSession) {
    const c = await models.Client.findOne({ _id: id, status: 'active', archivedAt: null }).session(
      session ?? null,
    )
    if (!c) throw hidden()
    const m = await models.Membership.findOne({
      ...scopeOf(c),
      userId: a.userId,
      status: 'active',
    }).session(session ?? null)
    if (!m) throw hidden()
    const contact = await models.Contact.exists({
      _id: m.contactId,
      ...scopeOf(c),
      archivedAt: null,
    }).session(session ?? null)
    const org = await tenantModels.Organization.exists({
      _id: c.organizationId,
      status: 'active',
    }).session(session ?? null)
    const ws = await tenantModels.Workspace.exists({
      _id: c.workspaceId,
      organizationId: c.organizationId,
      status: 'active',
    }).session(session ?? null)
    if (!contact || !org || !ws) throw hidden()
    return { c, m }
  }
  async function project(
    a: AuthContext,
    id: string,
    pid: string,
    ws?: string,
    session?: ClientSession,
  ) {
    let c
    let role = 'INTERNAL'
    if (ws) {
      c = await client(a, ws, id, session, false)
      await work.access(a, ws, pid, 'manage', session)
    } else {
      const p = await portal(a, id, session)
      c = p.c
      role = p.m.role
    }
    if (c.archivedAt || c.status !== 'active') throw hidden()
    const g = await models.Grant.findOne({
      ...scopeOf(c),
      projectId: pid,
      ...(ws ? {} : { status: 'active' }),
    }).session(session ?? null)
    const p = await workModels.Project.exists({
      _id: pid,
      organizationId: c.organizationId,
      workspaceId: c.workspaceId,
      status: { $ne: 'archived' },
    }).session(session ?? null)
    if (!g || !p) throw hidden()
    return { c, g, role }
  }
  async function audit(
    a: AuthContext,
    c: Parameters<typeof scopeOf>[0],
    action: string,
    session: ClientSession,
    resourceId?: Types.ObjectId,
    projectId?: string,
  ) {
    await models.Audit.create(
      [
        {
          ...scopeOf(c),
          actorId: a.userId,
          action,
          resourceId: resourceId ?? null,
          projectId: projectId ?? null,
        },
      ],
      { session },
    )
  }
  async function write<T>(
    a: AuthContext,
    ws: string | undefined,
    id: string,
    fn: (c: Awaited<ReturnType<typeof client>>, s: ClientSession) => Promise<T>,
    allowArchived = false,
  ) {
    return tenants.write(a, async (s) => {
      const c = ws ? await client(a, ws, id, s) : (await portal(a, id, s)).c
      if (c.archivedAt && !allowArchived) throw conflict()
      await tenants.guardOrganization(String(c.organizationId), s)
      return fn(c, s)
    })
  }
  const clientDto = (c: Awaited<ReturnType<typeof client>>) => ({
    ...baseDto(c),
    name: c.name,
    legalName: c.legalName,
    type: c.type,
    industry: c.industry,
    description: c.description,
    website: c.website,
    email: c.email,
    phone: c.phone,
    country: c.country,
    city: c.city,
    address: c.address,
    ownerId: String(c.ownerId),
    status: c.status,
    tags: c.tags,
    allowRepresentatives: c.allowRepresentatives,
    archivedAt: c.archivedAt?.toISOString() ?? null,
    createdAt: c.createdAt.toISOString(),
  })
  async function owner(a: AuthContext, ws: string, userId: string, s: ClientSession) {
    const u = await authModels.User.exists({
      _id: userId,
      accountStatus: 'active',
      emailVerifiedAt: { $ne: null },
    }).session(s)
    if (!u) throw hidden()
    await internal({ ...a, userId }, ws, s)
  }
  async function clients(a: AuthContext, ws: string, q: S.Query) {
    const status = statuses.find((value) => value === q.status)
    if (q.status && !status)
      throw new ApiError(422, 'VALIDATION_FAILED', 'Invalid client lifecycle status.')
    const s = await internal(a, ws)
    const search = q.search
      ? [...q.search].map((c) => ('\\^$.*+?()[]{}|'.includes(c) ? '\\' + c : c)).join('')
      : undefined
    const rows = await models.Client.find({
      organizationId: s.organization._id,
      workspaceId: ws,
      ...pageFilter(q),
      ...(status ? { status } : {}),
      ...(search ? { name: { $regex: search, $options: 'i' } } : {}),
    })
      .sort({ _id: q.sort === 'newest' ? -1 : 1 })
      .limit(q.limit + 1)
    return page(rows, q, clientDto)
  }
  async function getClient(a: AuthContext, ws: string, id: string) {
    return clientDto(await client(a, ws, id))
  }
  async function createClient(a: AuthContext, ws: string, input: S.CreateClient) {
    return tenants.write(a, async (s) => {
      const ctx = await internal(a, ws, s)
      await tenants.guardOrganization(String(ctx.organization._id), s)
      const digest = tokenHash(JSON.stringify(input))
      const old = await models.Client.findOne({
        workspaceId: ws,
        createdBy: a.userId,
        creationKey: input.creationKey,
      })
        .select('+requestDigest')
        .session(s)
      if (old) {
        if (old.requestDigest !== digest) throw conflict()
        return clientDto(old)
      }
      if ((await models.Client.countDocuments({ workspaceId: ws }).session(s)) >= 10000)
        throw conflict()
      await owner(a, ws, input.ownerId ?? a.userId, s)
      const [c] = await models.Client.create(
        [
          {
            ...defined(input),
            organizationId: ctx.organization._id,
            workspaceId: ws,
            ownerId: input.ownerId ?? a.userId,
            createdBy: a.userId,
            requestDigest: digest,
            archivedAt: input.status === 'archived' ? now() : null,
          },
        ],
        { session: s },
      )
      await audit(a, c!, 'client.created', s)
      return clientDto(c!)
    })
  }
  async function updateClient(a: AuthContext, ws: string, id: string, input: S.UpdateClient) {
    return write(
      a,
      ws,
      id,
      async (c, s) => {
        checkVersion(c, input.version)
        if (input.ownerId) await owner(a, ws, input.ownerId, s)
        Object.assign(c, input, { version: c.version + 1 })
        if (input.status) c.archivedAt = input.status === 'archived' ? now() : null
        await c.save({ session: s })
        await audit(a, c, 'client.updated', s)
        return clientDto(c)
      },
      true,
    )
  }
  const contactDto = (c: Awaited<ReturnType<typeof models.Contact.findOne>> & {}) => ({
    ...baseDto(c),
    name: c.name,
    email: c.email,
    title: c.title,
    phone: c.phone,
    role: c.role,
    primary: c.primary,
    archivedAt: c.archivedAt?.toISOString() ?? null,
  })
  async function contacts(a: AuthContext, ws: string, id: string, q: S.Query) {
    const c = await client(a, ws, id)
    const rows = await models.Contact.find({ ...scopeOf(c), ...pageFilter(q) })
      .sort({ _id: q.sort === 'newest' ? -1 : 1 })
      .limit(q.limit + 1)
    const memberships = await models.Membership.find({
      ...scopeOf(c),
      contactId: { $in: rows.map((r) => r._id) },
      status: 'active',
    }).select('contactId')
    return page(rows, q, (r) => ({
      ...contactDto(r),
      portalAccess: memberships.some((m) => String(m.contactId) === String(r._id)),
    }))
  }
  async function contact(
    a: AuthContext,
    ws: string,
    id: string,
    input: S.ContactInput | z.output<typeof S.updateContact>,
    contactId?: string,
  ) {
    return write(a, ws, id, async (c, s) => {
      if (!contactId && (await models.Contact.countDocuments(scopeOf(c)).session(s)) >= 1000)
        throw conflict()
      const { archived: initialArchived, ...initialFields } = input
      const row = contactId
        ? await models.Contact.findOne({ _id: contactId, ...scopeOf(c) }).session(s)
        : new models.Contact({
            ...scopeOf(c),
            ...initialFields,
            archivedAt: initialArchived ? now() : null,
          })
      if (!row) throw hidden()
      if ('version' in input) checkVersion(row, input.version)
      if (
        input.email &&
        input.email !== row.email &&
        contactId &&
        (await models.Membership.exists({
          ...scopeOf(c),
          contactId: row._id,
          status: 'active',
        }).session(s))
      )
        throw conflict()
      if (input.primary)
        await models.Contact.updateMany(
          { ...scopeOf(c), primary: true, _id: { $ne: row._id } },
          { $set: { primary: false }, $inc: { version: 1 } },
          { session: s },
        )
      const { archived, ...fields } = input
      Object.assign(row, fields)
      row.version += contactId ? 1 : 0
      if (archived !== undefined) {
        row.archivedAt = archived ? now() : null
        if (archived) {
          row.primary = false
          await models.Membership.updateMany(
            { ...scopeOf(c), contactId: row._id },
            { $set: { status: 'revoked' }, $inc: { version: 1 } },
            { session: s },
          )
          await models.Invitation.updateMany(
            { ...scopeOf(c), contactId: row._id, status: 'pending' },
            { $set: { status: 'revoked' } },
            { session: s },
          )
        }
      }
      await row.save({ session: s })
      await audit(a, c, contactId ? 'contact.updated' : 'contact.created', s, row._id)
      return contactDto(row)
    })
  }
  function send(to: string, token: string, c: { name: string }) {
    const task = mail
      .send({
        to,
        purpose: 'invitation',
        link: `${webOrigin}/portal/invitations#token=${token}`,
        context: {
          organizationName: c.name,
          workspaceNames: [],
          roles: ['Client portal access'],
          inviterName: 'Your agency',
          expiresAt: 'See invitation',
          message: 'This invitation grants client portal access only.',
        },
      })
      .catch(() => {
        logger.warn(
          { code: 'PORTAL_MAIL_FAILED' },
          'Portal invitation delivery failed; use resend.',
        )
      })
    pending.add(task)
    void task.finally(() => pending.delete(task))
  }
  async function invite(a: AuthContext, ws: string, id: string, input: z.output<typeof S.invite>) {
    const token = randomToken()
    const result = await write(a, ws, id, async (c, s) => {
      const contact = await models.Contact.findOne({
        _id: input.contactId,
        ...scopeOf(c),
        archivedAt: null,
      }).session(s)
      if (!contact || c.status !== 'active') throw hidden()
      await models.Invitation.updateMany(
        { ...scopeOf(c), contactId: contact._id, status: 'pending', expiresAt: { $lte: now() } },
        { $set: { status: 'expired' } },
        { session: s },
      )
      if (
        await models.Membership.exists({
          ...scopeOf(c),
          contactId: contact._id,
          status: 'active',
        }).session(s)
      )
        throw conflict()
      const [r] = await models.Invitation.create(
        [
          {
            ...scopeOf(c),
            contactId: contact._id,
            email: contact.email,
            role: input.role,
            issuedBy: a.userId,
            tokenHash: tokenHash(token),
            expiresAt: new Date(+now() + input.expiresInHours * 3600000),
            sentAt: now(),
          },
        ],
        { session: s },
      )
      await audit(a, c, 'invitation.created', s, r!._id)
      return { email: contact.email, c, id: String(r!._id) }
    })
    send(result.email, token, result.c)
    return { id: result.id }
  }
  async function invitations(a: AuthContext, ws: string, id: string, q: S.Query) {
    const c = await client(a, ws, id)
    const rows = await models.Invitation.find({ ...scopeOf(c), ...pageFilter(q) })
      .sort({ _id: q.sort === 'newest' ? -1 : 1 })
      .limit(q.limit + 1)
    return page(rows, q, (r) => ({
      ...baseDto(r),
      contactId: String(r.contactId),
      role: r.role,
      status: r.status === 'pending' && r.expiresAt <= now() ? 'expired' : r.status,
      expiresAt: r.expiresAt.toISOString(),
    }))
  }
  async function changeInvitation(
    a: AuthContext,
    ws: string,
    id: string,
    iid: string,
    resend: boolean,
  ) {
    const token = randomToken()
    const result = await write(a, ws, id, async (c, s) => {
      const r = await models.Invitation.findOne({
        _id: iid,
        ...scopeOf(c),
        status: 'pending',
        expiresAt: { $gt: now() },
      })
        .select('+email')
        .session(s)
      if (!r) throw expired()
      if (resend) {
        if (+now() - +r.sentAt < 60000) throw conflict()
        const ct = await models.Contact.exists({
          _id: r.contactId,
          ...scopeOf(c),
          email: r.email,
          archivedAt: null,
        }).session(s)
        if (!ct) throw expired()
        r.tokenHash = tokenHash(token)
        r.sentAt = now()
      } else r.status = 'revoked'
      r.version++
      await r.save({ session: s })
      await audit(a, c, resend ? 'invitation.resent' : 'invitation.revoked', s, r._id)
      return { c, email: r.email }
    })
    if (resend) send(result.email, token, result.c)
    return { success: true }
  }
  async function preview(token: string) {
    const r = await models.Invitation.findOne({
      tokenHash: tokenHash(token),
      status: 'pending',
      expiresAt: { $gt: now() },
    })
    if (!r) throw expired()
    const c = await models.Client.findOne({
      _id: r.clientId,
      organizationId: r.organizationId,
      workspaceId: r.workspaceId,
      status: 'active',
    })
    if (!c) throw expired()
    return { clientName: c.name, role: r.role, expiresAt: r.expiresAt.toISOString() }
  }
  async function accept(a: AuthContext, token: string) {
    return tenants.write(a, async (s) => {
      const r = await models.Invitation.findOne({
        tokenHash: tokenHash(token),
        status: 'pending',
        expiresAt: { $gt: now() },
      })
        .select('+email')
        .session(s)
      if (!r) throw expired()
      if (r.email !== a.user.email) throw denied()
      const c = await client(
        { ...a, userId: String(r.issuedBy) },
        String(r.workspaceId),
        String(r.clientId),
        s,
      )
      const issuer = await authModels.User.findOneAndUpdate(
        { _id: r.issuedBy, accountStatus: 'active', emailVerifiedAt: { $ne: null } },
        { $inc: { authLock: 1 } },
        { session: s },
      )
      if (!issuer || c.status !== 'active') throw expired()
      await tenants.guardOrganization(String(c.organizationId), s)
      const ct = await models.Contact.exists({
        _id: r.contactId,
        ...scopeOf(c),
        email: r.email,
        archivedAt: null,
      }).session(s)
      if (!ct) throw expired()
      const old = await models.Membership.findOne({ ...scopeOf(c), userId: a.userId }).session(s)
      if (!old)
        await models.Membership.create(
          [
            {
              ...scopeOf(c),
              userId: a.userId,
              contactId: r.contactId,
              role: r.role,
              status: 'active',
              joinedAt: now(),
            },
          ],
          { session: s },
        )
      else if (old.status === 'revoked') {
        old.status = 'active'
        old.role = r.role
        old.contactId = r.contactId
        old.joinedAt = now()
        old.version++
        await old.save({ session: s })
      }
      r.status = 'accepted'
      r.version++
      await r.save({ session: s })
      await audit(a, c, 'invitation.accepted', s, r._id)
      return { clientId: String(c._id) }
    })
  }
  async function memberships(a: AuthContext, id: string, q: S.Query, ws?: string) {
    const c = ws ? await client(a, ws, id) : (await portal(a, id)).c
    const rows = await models.Membership.find({ ...scopeOf(c), ...pageFilter(q) })
      .sort({ _id: q.sort === 'newest' ? -1 : 1 })
      .limit(q.limit + 1)
    const contacts = await models.Contact.find({
      ...scopeOf(c),
      _id: { $in: rows.map((r) => r.contactId) },
    }).select('name')
    return page(rows, q, (r) => ({
      ...baseDto(r),
      name: contacts.find((ct) => String(ct._id) === String(r.contactId))?.name ?? 'Representative',
      role: r.role,
      status: r.status,
      ...(ws
        ? { userId: String(r.userId), contactId: String(r.contactId) }
        : { self: String(r.userId) === a.userId }),
    }))
  }
  async function membership(
    a: AuthContext,
    id: string,
    mid: string,
    input: z.output<typeof S.membership>,
    ws?: string,
  ) {
    return write(a, ws, id, async (c, s) => {
      const row = await models.Membership.findOne({ _id: mid, ...scopeOf(c) }).session(s)
      if (!row) throw hidden()
      checkVersion(row, input.version)
      if (!ws) {
        const p = await portal(a, id, s)
        if (
          !c.allowRepresentatives ||
          p.m.role !== 'CLIENT_ADMIN' ||
          row.role === 'CLIENT_ADMIN' ||
          input.role === 'CLIENT_ADMIN' ||
          String(row.userId) === a.userId ||
          input.status === 'active'
        )
          throw denied()
      }
      Object.assign(row, input, { version: row.version + 1 })
      await row.save({ session: s })
      await audit(a, c, 'membership.updated', s, row._id)
      return baseDto(row)
    })
  }
  const grantDto = (g: Awaited<ReturnType<typeof models.Grant.findOne>> & {}) => ({
    ...baseDto(g),
    projectId: String(g.projectId),
    title: g.title,
    description: g.description,
    status: g.status,
    progress: g.progress,
    milestones: g.milestones,
    deliverables: g.deliverables,
    feedback: g.feedback,
    changes: g.changes,
    approve: g.approve,
  })
  async function grants(a: AuthContext, ws: string, id: string, q: S.Query) {
    const c = await client(a, ws, id)
    return page(
      await models.Grant.find({ ...scopeOf(c), ...pageFilter(q) })
        .sort({ _id: q.sort === 'newest' ? -1 : 1 })
        .limit(q.limit + 1),
      q,
      grantDto,
    )
  }
  async function share(a: AuthContext, ws: string, id: string, input: z.output<typeof S.share>) {
    return write(a, ws, id, async (c, s) => {
      if ((await models.Grant.countDocuments(scopeOf(c)).session(s)) >= 1000) throw conflict()
      const p = await work.access(a, ws, input.projectId, 'manage', s)
      if (p.project.status === 'archived' || c.status !== 'active') throw conflict()
      const [g] = await models.Grant.create(
        [
          {
            ...scopeOf(c),
            ...defined(input),
            grantedBy: a.userId,
            grantedAt: now(),
            revokedAt: input.status === 'revoked' ? now() : null,
          },
        ],
        { session: s },
      )
      await audit(a, c, 'project.shared', s, g!._id, input.projectId)
      return grantDto(g!)
    })
  }
  async function updateGrant(
    a: AuthContext,
    ws: string,
    id: string,
    pid: string,
    input: z.output<typeof S.updateGrant>,
  ) {
    return write(a, ws, id, async (c, s) => {
      await work.access(a, ws, pid, 'manage', s)
      const g = await models.Grant.findOne({ ...scopeOf(c), projectId: pid }).session(s)
      if (!g) throw hidden()
      checkVersion(g, input.version)
      Object.assign(g, input, { version: g.version + 1 })
      if (input.status) g.revokedAt = input.status === 'revoked' ? now() : null
      await g.save({ session: s })
      await audit(a, c, 'project.grant_updated', s, g._id, pid)
      return grantDto(g)
    })
  }
  async function myPortals(a: AuthContext, q: S.Query) {
    const rows = await models.Membership.find({
      userId: a.userId,
      status: 'active',
      ...pageFilter(q),
    })
      .sort({ _id: q.sort === 'newest' ? -1 : 1 })
      .limit(q.limit + 1)
    const items = []
    for (const r of rows.slice(0, q.limit)) {
      try {
        const { c, m } = await portal(a, String(r.clientId))
        items.push({ id: String(c._id), name: c.name, role: m.role })
      } catch (e) {
        if (!(e instanceof ApiError && e.statusCode === 404)) throw e
      }
    }
    return {
      items,
      hasMore: rows.length > q.limit,
      nextCursor: rows.length > q.limit ? String(rows[q.limit - 1]!._id) : null,
    }
  }
  async function portalProjects(a: AuthContext, id: string, q: S.Query) {
    const { c, m } = await portal(a, id)
    const rows = await models.Grant.aggregate([
      { $match: { ...scopeOf(c), status: 'active', ...pageFilter(q) } },
      { $lookup: { from: 'projects', localField: 'projectId', foreignField: '_id', as: 'p' } },
      {
        $match: {
          'p.status': { $ne: 'archived' },
          'p.organizationId': c.organizationId,
          'p.workspaceId': c.workspaceId,
        },
      },
      { $sort: { _id: q.sort === 'newest' ? -1 : 1 } },
      { $limit: q.limit + 1 },
      { $project: { p: 0 } },
    ])
    return {
      ...page(rows, q, grantDto),
      client: { id, name: c.name, role: m.role, allowRepresentatives: c.allowRepresentatives },
    }
  }
  async function portalProject(a: AuthContext, id: string, pid: string, ws?: string) {
    const { c, g, role } = await project(a, id, pid, ws)
    return { client: { id, name: c.name }, project: grantDto(g), role }
  }
  async function resources(a: AuthContext, id: string, pid: string, q: S.Query, ws?: string) {
    const { c, g, role } = await project(a, id, pid, ws)
    const allowed = kinds.filter((kind) => g[permissions[kind]])
    if (!ws && q.kind && !allowed.includes(q.kind)) throw hidden()
    if (!ws && q.kind === 'reply' && !q.parentId) throw hidden()
    let paging: Record<string, unknown> = pageFilter(q)
    if (q.sort === 'position') {
      if (q.kind !== 'milestone')
        throw new ApiError(
          422,
          'VALIDATION_FAILED',
          'Position sorting is only available for milestones.',
        )
      paging = {}
      if (q.cursor) {
        const pivot = await models.Resource.findOne({
          _id: q.cursor,
          ...scopeOf(c),
          projectId: pid,
          kind: 'milestone',
          ...(!ws ? { published: true, status: { $ne: 'archived' } } : {}),
        })
        if (!pivot) throw hidden()
        paging = {
          $or: [
            { position: { $gt: pivot.position } },
            { position: pivot.position, _id: { $gt: pivot._id } },
          ],
        }
      }
    }
    const filter = {
      ...scopeOf(c),
      projectId: pid,
      ...paging,
      ...(q.kind
        ? { kind: q.kind }
        : ws
          ? {}
          : { kind: { $in: allowed.filter((k) => k !== 'reply') } }),
      ...(q.parentId ? { parentId: q.parentId } : {}),
      ...(!ws ? { published: true, status: { $nin: ['draft', 'archived', 'superseded'] } } : {}),
    }
    if (q.parentId) {
      const parent = await models.Resource.findOne({
        _id: q.parentId,
        ...scopeOf(c),
        projectId: pid,
        kind: 'feedback',
        ...(!ws ? { published: true } : {}),
      })
      if (!parent) throw hidden()
    }
    const rows = await models.Resource.find(filter)
      .sort(q.sort === 'position' ? { position: 1, _id: 1 } : { _id: q.sort === 'newest' ? -1 : 1 })
      .limit(q.limit + 1)
    return page(rows, q, (r) => ({
      ...resourceDto(r, !!ws),
      canEdit:
        !!ws ||
        (role !== 'CLIENT_VIEWER' &&
          r.kind === 'feedback' &&
          r.status === 'open' &&
          String(r.createdBy) === a.userId),
    }))
  }
  async function resource(a: AuthContext, id: string, pid: string, rid: string, ws?: string) {
    const { c, g, role } = await project(a, id, pid, ws)
    const r = await models.Resource.findOne({ _id: rid, ...scopeOf(c), projectId: pid })
    if (
      !r ||
      (!ws &&
        (!r.published ||
          !g[permissions[r.kind]] ||
          ['draft', 'archived', 'superseded'].includes(r.status)))
    )
      throw hidden()
    if (
      !ws &&
      r.kind === 'reply' &&
      !(await models.Resource.exists({
        _id: r.parentId,
        ...scopeOf(c),
        projectId: pid,
        kind: 'feedback',
        published: true,
      }))
    )
      throw hidden()
    return {
      ...resourceDto(r, !!ws),
      canEdit:
        !!ws ||
        (role !== 'CLIENT_VIEWER' &&
          r.kind === 'feedback' &&
          r.status === 'open' &&
          String(r.createdBy) === a.userId),
    }
  }
  async function resourceWrite<T>(
    a: AuthContext,
    id: string,
    pid: string,
    ws: string | undefined,
    fn: (ctx: Awaited<ReturnType<typeof project>>, s: ClientSession) => Promise<T>,
  ) {
    return tenants.write(a, async (s) => {
      const ctx = await project(a, id, pid, ws, s)
      await tenants.guardOrganization(String(ctx.c.organizationId), s)
      return fn(ctx, s)
    })
  }
  async function createResource(
    a: AuthContext,
    id: string,
    pid: string,
    input: S.ResourceInput,
    ws?: string,
  ) {
    return resourceWrite(a, id, pid, ws, async ({ c, g, role }, s) => {
      if (
        !ws &&
        (role === 'CLIENT_VIEWER' ||
          !['feedback', 'change', 'reply'].includes(input.kind) ||
          !g[permissions[input.kind]])
      )
        throw denied()
      if (input.kind === 'reply') {
        if (!input.parentId) throw hidden()
        const parent = await models.Resource.findOne({
          _id: input.parentId,
          ...scopeOf(c),
          projectId: pid,
          kind: 'feedback',
          ...(!ws ? { published: true } : {}),
        }).session(s)
        if (!parent || parent.status === 'closed') throw conflict()
      } else if (input.parentId) throw conflict()
      const digest = tokenHash(JSON.stringify(input))
      const old = await models.Resource.findOne({
        ...scopeOf(c),
        projectId: pid,
        createdBy: a.userId,
        creationKey: input.creationKey,
      })
        .select('+requestDigest')
        .session(s)
      if (old) {
        if (old.requestDigest !== digest) throw conflict()
        return resourceDto(old, !!ws)
      }
      if (
        (await models.Resource.countDocuments({ ...scopeOf(c), projectId: pid }).session(s)) >=
        10000
      )
        throw conflict()
      let revision = 1
      if (input.previousId) {
        if (!ws || input.kind !== 'deliverable') throw denied()
        const previous = await models.Resource.findOne({
          _id: input.previousId,
          ...scopeOf(c),
          projectId: pid,
          kind: 'deliverable',
          status: { $in: ['shared', 'approved', 'changes_requested'] },
        }).session(s)
        if (!previous) throw conflict()
        previous.status = 'superseded'
        previous.version++
        await previous.save({ session: s })
        revision = previous.revision + 1
      }
      const status = {
        progress: 'draft',
        milestone: 'planned',
        feedback: 'open',
        reply: 'open',
        change: 'submitted',
        deliverable: 'draft',
      }[input.kind]
      if (input.status && input.status !== status) throw conflict()
      if (input.published && ['progress', 'deliverable'].includes(input.kind)) throw conflict()
      if (
        !ws &&
        Object.keys(input).some(
          (k) => !['title', 'body', 'kind', 'creationKey', 'parentId', 'priority'].includes(k),
        )
      )
        throw denied()
      const [r] = await models.Resource.create(
        [
          {
            ...scopeOf(c),
            ...defined(input),
            projectId: pid,
            status,
            published: ws ? (input.published ?? false) : true,
            createdBy: a.userId,
            revision,
            requestDigest: digest,
          },
        ],
        { session: s },
      )
      await audit(a, c, `${input.kind}.created`, s, r!._id, pid)
      return resourceDto(r!, !!ws)
    })
  }
  async function updateResource(
    a: AuthContext,
    id: string,
    pid: string,
    rid: string,
    input: S.ResourceUpdate,
    ws?: string,
  ) {
    return resourceWrite(a, id, pid, ws, async ({ c, g, role }, s) => {
      const r = await models.Resource.findOne({ _id: rid, ...scopeOf(c), projectId: pid }).session(
        s,
      )
      if (!r) throw hidden()
      if (
        !ws &&
        (!r.published || !g[permissions[r.kind]] || ['archived', 'superseded'].includes(r.status))
      )
        throw hidden()
      checkVersion(r, input.version)
      const deciding =
        r.kind === 'deliverable' && ['approved', 'changes_requested'].includes(input.status ?? '')
      if (!ws) {
        if (role === 'CLIENT_VIEWER') throw denied()
        if (deciding) {
          if (
            !g.approve ||
            r.status !== 'shared' ||
            Object.keys(input).some((k) => !['version', 'status', 'decisionNote'].includes(k))
          )
            throw denied()
        } else {
          if (
            r.kind !== 'feedback' ||
            String(r.createdBy) !== a.userId ||
            r.status !== 'open' ||
            Object.keys(input).some((k) => !['version', 'title', 'body'].includes(k))
          )
            throw denied()
        }
      } else if (deciding) throw denied()
      if (
        input.status &&
        input.status !== r.status &&
        !transitions[r.kind]?.[r.status]?.includes(input.status)
      )
        throw conflict()
      if (
        ['progress', 'deliverable'].includes(r.kind) &&
        r.status !== 'draft' &&
        Object.keys(input).some(
          (k) =>
            !(deciding ? ['version', 'status', 'decisionNote'] : ['version', 'status']).includes(k),
        )
      )
        throw conflict()
      if (input.published !== undefined && ['progress', 'deliverable', 'change'].includes(r.kind))
        throw conflict()
      if (input.taskId) {
        if (
          !ws ||
          r.kind !== 'change' ||
          !['approved', 'completed'].includes(input.status ?? r.status)
        )
          throw denied()
        await work.access(a, ws, pid, 'contribute', s)
        if (
          !(await workModels.Task.exists({
            _id: input.taskId,
            organizationId: c.organizationId,
            workspaceId: c.workspaceId,
            projectId: pid,
            archivedAt: null,
          }).session(s))
        )
          throw hidden()
      }
      Object.assign(r, input, { version: r.version + 1 })
      if (
        (r.kind === 'progress' && r.status === 'published') ||
        (r.kind === 'deliverable' && r.status === 'shared')
      ) {
        r.published = true
        r.publishedAt = now()
      }
      if (deciding || (r.kind === 'change' && input.status)) {
        r.decisionBy = oid(a.userId)
        r.decisionAt = now()
      }
      await r.save({ session: s })
      await audit(a, c, `${r.kind}.${input.status ?? 'updated'}`, s, r._id, pid)
      return resourceDto(r, !!ws)
    })
  }
  async function activity(a: AuthContext, ws: string, id: string, q: S.Query) {
    const c = await client(a, ws, id)
    return page(
      await models.Audit.find({ ...scopeOf(c), ...pageFilter(q) })
        .sort({ _id: q.sort === 'newest' ? -1 : 1 })
        .limit(q.limit + 1),
      q,
      (r) => ({
        id: String(r._id),
        action: r.action,
        createdAt: r.createdAt.toISOString(),
        resourceId: r.resourceId ? String(r.resourceId) : null,
      }),
    )
  }
  async function dashboard(a: AuthContext, id: string) {
    const { c, m } = await portal(a, id)
    const shared = await models.Grant.aggregate([
      { $match: { ...scopeOf(c), status: 'active' } },
      { $lookup: { from: 'projects', localField: 'projectId', foreignField: '_id', as: 'p' } },
      {
        $match: {
          'p.status': { $ne: 'archived' },
          'p.organizationId': c.organizationId,
          'p.workspaceId': c.workspaceId,
        },
      },
      {
        $project: {
          projectId: 1,
          approve: 1,
          deliverables: 1,
          progress: 1,
          milestones: 1,
          feedback: 1,
        },
      },
    ])
    const projectIds = (key: 'approve' | 'progress' | 'milestones' | 'feedback') =>
      shared.filter((g) => g[key] && (key !== 'approve' || g.deliverables)).map((g) => g.projectId)
    const base = { ...scopeOf(c), published: true }
    const pendingApprovals = await models.Resource.countDocuments({
      ...base,
      projectId: { $in: projectIds('approve') },
      kind: 'deliverable',
      status: 'shared',
    })
    const recent = await models.Resource.find({
      ...base,
      projectId: { $in: projectIds('progress') },
      kind: 'progress',
      status: 'published',
    })
      .sort({ _id: -1 })
      .limit(5)
    const milestones = await models.Resource.find({
      ...base,
      projectId: { $in: projectIds('milestones') },
      kind: 'milestone',
      status: { $nin: ['archived', 'completed'] },
      dueDate: { $gte: now().toISOString().slice(0, 10) },
    })
      .sort({ dueDate: 1, _id: 1 })
      .limit(10)
    const feedback = await models.Resource.find({
      ...base,
      projectId: { $in: projectIds('feedback') },
      kind: 'feedback',
    })
      .sort({ _id: -1 })
      .limit(5)
    return {
      client: { id, name: c.name, role: m.role, allowRepresentatives: c.allowRepresentatives },
      sharedProjects: shared.length,
      pendingApprovals,
      recentUpdates: recent.map((r) => resourceDto(r)),
      milestones: milestones.map((r) => resourceDto(r)),
      recentFeedback: feedback.map((r) => resourceDto(r)),
    }
  }
  return {
    clients,
    getClient,
    createClient,
    updateClient,
    contacts,
    contact,
    invite,
    invitations,
    changeInvitation,
    preview,
    accept,
    memberships,
    membership,
    grants,
    share,
    updateGrant,
    myPortals,
    portalProjects,
    portalProject,
    resources,
    resource,
    createResource,
    updateResource,
    activity,
    dashboard,
    drainMail: () => Promise.all([...pending]),
  }
}
export type ClientService = ReturnType<typeof createClientService>
