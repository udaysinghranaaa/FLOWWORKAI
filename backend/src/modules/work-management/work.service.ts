import type { TenantModels } from '../organizations/tenant.models.js'
import type { WorkspaceRole } from '../memberships/membership.models.js'
import { Types, type ClientSession, type InferSchemaType } from 'mongoose'
import type { TenantService } from '../organizations/tenant.service.js'
import type { AuthModels } from '../auth/auth.models.js'
import type { AuthContext } from '../auth/auth.service.js'
import { tokenHash } from '../auth/auth.crypto.js'
import { canCreateProject, projectCapabilities } from '../memberships/permissions.js'
import { ApiError } from '../../lib/api-error.js'
import type { WorkModels } from './work.models.js'
import type { projectSchema } from '../projects/project.model.js'
import type { taskSchema } from '../tasks/task.model.js'
import { projectTransitions, taskStatuses } from './work.constants.js'
import type * as S from './work.schema.js'
const hidden = () => new ApiError(404, 'NOT_FOUND', 'This resource is unavailable.')
const denied = () => new ApiError(403, 'FORBIDDEN', 'You do not have permission for this action.')
const conflict = (message = 'This record changed. Refresh before trying again.') =>
  new ApiError(409, 'CONFLICT', message)
type Project = InferSchemaType<typeof projectSchema> & { _id: Types.ObjectId }
type Task = InferSchemaType<typeof taskSchema> & { _id: Types.ObjectId }
const dateFields = (input: {
  startDate?: string | null | undefined
  dueDate?: string | null | undefined
}) => ({
  startDate: input.startDate ? new Date(input.startDate) : null,
  dueDate: input.dueDate ? new Date(input.dueDate) : null,
})
const day = (value: Date | null | undefined) => value?.toISOString().slice(0, 10) ?? null
const projectDto = (p: Project) => ({
  id: String(p._id),
  organizationId: String(p.organizationId),
  workspaceId: String(p.workspaceId),
  name: p.name,
  slug: p.slug,
  description: p.description,
  ownerUserId: String(p.ownerUserId),
  createdBy: String(p.createdBy),
  status: p.status,
  previousStatus: p.previousStatus,
  priority: p.priority,
  color: p.color,
  startDate: day(p.startDate),
  dueDate: day(p.dueDate),
  version: p.version,
  createdAt: p.createdAt.toISOString(),
  updatedAt: p.updatedAt.toISOString(),
})
const taskDto = (t: Task) => ({
  id: String(t._id),
  organizationId: String(t.organizationId),
  workspaceId: String(t.workspaceId),
  projectId: String(t.projectId),
  title: t.title,
  description: t.description,
  status: t.status,
  priority: t.priority,
  assigneeId: t.assigneeId ? String(t.assigneeId) : null,
  createdBy: String(t.createdBy),
  parentTaskId: t.parentTaskId ? String(t.parentTaskId) : null,
  labels: t.labels,
  startDate: day(t.startDate),
  dueDate: day(t.dueDate),
  completedAt: t.completedAt?.toISOString() ?? null,
  archivedAt: t.archivedAt?.toISOString() ?? null,
  position: t.position,
  version: t.version,
  createdAt: t.createdAt.toISOString(),
  updatedAt: t.updatedAt.toISOString(),
})
const scoped = (project: Project) => ({
  organizationId: project.organizationId,
  workspaceId: project.workspaceId,
  projectId: project._id,
})
const escape = (value: string) =>
  [...value]
    .map((char) =>
      '.+*?^$()[]{}|'.includes(char) || char.charCodeAt(0) === 92
        ? String.fromCharCode(92) + char
        : char,
    )
    .join('')
function cursorFilter(input: S.PageQuery, sort: string): Record<string, unknown> {
  if (!input.cursor) return {}
  try {
    const value = JSON.parse(Buffer.from(input.cursor, 'base64url').toString()) as {
      id: string
      sort: string
      value: string | null
    }
    if (
      !/^[a-f0-9]{24}$/.test(value.id) ||
      value.sort !== sort ||
      (value.value !== null &&
        (typeof value.value !== 'string' || Number.isNaN(Date.parse(value.value))))
    )
      throw new Error()
    const date = value.value ? new Date(value.value) : null
    return sort === 'dueDate'
      ? {
          $or: [
            ...(date ? [{ dueDate: { $gt: date } }] : [{ dueDate: { $type: 'date' } }]),
            { dueDate: date, _id: { $gt: new Types.ObjectId(value.id) } },
          ],
        }
      : {
          $or: [
            { [sort]: { $lt: date } },
            { [sort]: date, _id: { $lt: new Types.ObjectId(value.id) } },
          ],
        }
  } catch {
    throw new ApiError(422, 'VALIDATION_FAILED', 'Invalid page cursor.')
  }
}
function result<T extends { _id: Types.ObjectId }>(
  rows: T[],
  input: S.PageQuery,
  sort: string,
  serialize: (row: T) => unknown,
) {
  const items = rows.slice(0, input.limit),
    last = items.at(-1),
    value = last ? (last as Record<string, unknown>)[sort] : null
  return {
    items: items.map(serialize),
    hasMore: rows.length > input.limit,
    nextCursor:
      rows.length > input.limit && last
        ? Buffer.from(
            JSON.stringify({
              id: String(last._id),
              sort,
              value: value instanceof Date ? value.toISOString() : null,
            }),
          ).toString('base64url')
        : null,
  }
}
export function createWorkService({
  models,
  tenants,
  tenantModels,
  authModels,
  now = () => new Date(),
}: {
  models: WorkModels
  tenants: TenantService
  tenantModels: TenantModels
  authModels: AuthModels
  now?: () => Date
}) {
  async function context(actor: AuthContext, workspaceId: string, session?: ClientSession) {
    return tenants.workspaceContext(actor, workspaceId, 'workspace.read', session)
  }
  async function access(
    actor: AuthContext,
    workspaceId: string,
    projectId: string,
    action: 'read' | 'manage' | 'contribute' | 'moderate' = 'read',
    session?: ClientSession,
  ) {
    const scope = await context(actor, workspaceId, session)
    const project = await models.Project.findOne({
      _id: projectId,
      organizationId: scope.organization._id,
      workspaceId,
    }).session(session ?? null)
    if (!project) throw hidden()
    const member = await models.ProjectMembership.findOne({
      ...scoped(project),
      userId: actor.userId,
      status: 'active',
    }).session(session ?? null)
    const permissions = projectCapabilities(
      scope.workspaceRole!,
      member?.role,
      String(project.ownerUserId) === actor.userId,
    )
    if (!permissions.read) throw hidden()
    if (!permissions[action]) throw denied()
    return { scope, project, permissions }
  }
  async function workspaceWrite<T>(
    actor: AuthContext,
    workspaceId: string,
    operation: (scope: Awaited<ReturnType<typeof context>>, session: ClientSession) => Promise<T>,
  ) {
    return tenants.write(actor, async (session) => {
      const scope = await context(actor, workspaceId, session)
      if (scope.organization.status !== 'active' || scope.workspace?.status !== 'active')
        throw conflict('Restore the company and workspace before editing.')
      await tenants.guardOrganization(String(scope.organization._id), session)
      return operation(scope, session)
    })
  }
  async function projectWrite<T>(
    actor: AuthContext,
    workspaceId: string,
    projectId: string,
    action: 'manage' | 'contribute' | 'moderate',
    operation: (
      project: Project,
      permissions: ReturnType<typeof projectCapabilities>,
      session: ClientSession,
    ) => Promise<T>,
    allowArchived = false,
  ) {
    return workspaceWrite(actor, workspaceId, async (_scope, session) => {
      const data = await access(actor, workspaceId, projectId, action, session)
      if (data.project.status === 'archived' && !allowArchived)
        throw conflict('Restore this project before editing.')
      await models.Project.updateOne(
        { _id: projectId, workspaceId, organizationId: data.project.organizationId },
        { $inc: { version: 1 } },
        { session },
      )
      return operation(data.project, data.permissions, session)
    })
  }
  async function eligible(
    actor: AuthContext,
    project: Project,
    userId: string,
    session: ClientSession,
    manager = false,
  ) {
    const user = await authModels.User.findOneAndUpdate(
      { _id: userId, accountStatus: 'active', emailVerifiedAt: { $ne: null } },
      { $inc: { authLock: 1 } },
      { session },
    ).select('_id')
    if (!user)
      throw new ApiError(422, 'VALIDATION_FAILED', 'Choose an eligible active project member.')
    try {
      const target = { ...actor, userId }
      const data = await access(
        target,
        String(project.workspaceId),
        String(project._id),
        'read',
        session,
      )
      if (!data.permissions.contribute || (manager && !data.permissions.manage)) throw denied()
    } catch {
      throw new ApiError(422, 'VALIDATION_FAILED', 'Choose an eligible active project member.')
    }
  }
  async function event(
    actor: AuthContext,
    project: Project,
    action: string,
    session: ClientSession,
    taskId?: Types.ObjectId,
    metadata: { fields?: string[]; from?: string; to?: string } = {},
  ) {
    await models.Activity.create(
      [{ ...scoped(project), actorId: actor.userId, action, taskId: taskId ?? null, metadata }],
      { session },
    )
  }
  async function users(ids: Types.ObjectId[]) {
    const rows = await authModels.User.find({ _id: { $in: ids } }).select('name')
    return new Map(rows.map((row) => [String(row._id), { id: String(row._id), name: row.name }]))
  }
  async function workspaceMemberStates(p: Project, ids: Types.ObjectId[]) {
    const [people, organizations, workspaces] = await Promise.all([
      authModels.User.find({ _id: { $in: ids } }).select('name accountStatus emailVerifiedAt'),
      tenantModels.OrganizationMembership.find({
        organizationId: p.organizationId,
        userId: { $in: ids },
        status: 'active',
      }).select('userId role'),
      tenantModels.WorkspaceMembership.find({
        organizationId: p.organizationId,
        workspaceId: p.workspaceId,
        userId: { $in: ids },
        status: 'active',
      }).select('userId role'),
    ])
    return new Map(
      ids.map((id) => {
        const person = people.find((row) => String(row._id) === String(id)),
          org = organizations.find((row) => String(row.userId) === String(id)),
          workspace = workspaces.find((row) => String(row.userId) === String(id))
        const role: WorkspaceRole | undefined =
          org?.role === 'OWNER'
            ? 'OWNER'
            : org?.role === 'ADMIN'
              ? workspace?.role === 'OWNER'
                ? 'OWNER'
                : 'ADMIN'
              : (workspace?.role as WorkspaceRole | undefined)
        return [
          String(id),
          {
            person: person ? { id: String(person._id), name: person.name } : undefined,
            role,
            active:
              !!org && !!role && person?.accountStatus === 'active' && !!person.emailVerifiedAt,
          },
        ] as const
      }),
    )
  }
  async function projects(actor: AuthContext, workspaceId: string, input: S.ListQuery) {
    const scope = await context(actor, workspaceId),
      admin = ['OWNER', 'ADMIN'].includes(scope.workspaceRole!)
    const grants = admin
      ? []
      : await models.ProjectMembership.find({
          organizationId: scope.organization._id,
          workspaceId,
          userId: actor.userId,
          status: 'active',
        })
          .select('projectId role')
          .limit(1000)
    const rows = await models.Project.find({
      organizationId: scope.organization._id,
      workspaceId,
      $and: [
        ...(!admin
          ? [
              {
                $or: [
                  { _id: { $in: grants.map((g) => g.projectId) } },
                  { ownerUserId: actor.userId },
                ],
              },
            ]
          : []),
        cursorFilter(input, input.sort),
      ],
      status: input.status ?? { $ne: 'archived' },
      ...(input.search ? { name: { $regex: escape(input.search), $options: 'i' } } : {}),
    })
      .sort({ [input.sort]: -1, _id: -1 })
      .limit(input.limit + 1)
    const counts = await models.Task.aggregate<{
      _id: Types.ObjectId
      total: number
      done: number
    }>([
      {
        $match: {
          organizationId: scope.organization._id,
          workspaceId: new Types.ObjectId(workspaceId),
          projectId: { $in: rows.map((p) => p._id) },
          archivedAt: null,
        },
      },
      {
        $group: {
          _id: '$projectId',
          total: { $sum: 1 },
          done: { $sum: { $cond: [{ $eq: ['$status', 'done'] }, 1, 0] } },
        },
      },
    ])
    const previews = await models.ProjectMembership.aggregate<{
      _id: Types.ObjectId
      userIds: Types.ObjectId[]
      count: number
    }>([
      {
        $match: {
          organizationId: scope.organization._id,
          workspaceId: new Types.ObjectId(workspaceId),
          projectId: { $in: rows.map((p) => p._id) },
          status: 'active',
        },
      },
      { $sort: { _id: 1 } },
      { $group: { _id: '$projectId', userIds: { $push: '$userId' }, count: { $sum: 1 } } },
      { $project: { userIds: { $slice: ['$userIds', 3] }, count: 1 } },
    ])
    const names = await users([
      ...rows.map((p) => p.ownerUserId),
      ...previews.flatMap((p) => p.userIds),
    ])
    return result(rows, input, input.sort, (p) => ({
      ...projectDto(p),
      owner: names.get(String(p.ownerUserId)),
      members:
        previews
          .find((row) => String(row._id) === String(p._id))
          ?.userIds.map((id) => names.get(String(id)))
          .filter(Boolean) ?? [],
      memberCount: previews.find((row) => String(row._id) === String(p._id))?.count ?? 0,
      totalTasks: counts.find((c) => String(c._id) === String(p._id))?.total ?? 0,
      completedTasks: counts.find((c) => String(c._id) === String(p._id))?.done ?? 0,
    }))
  }
  async function createProject(actor: AuthContext, workspaceId: string, input: S.ProjectCreate) {
    return workspaceWrite(actor, workspaceId, async (scope, session) => {
      if (!canCreateProject(scope.workspaceRole!)) throw denied()
      const digest = tokenHash(JSON.stringify(input)),
        existing = await models.Project.findOne({
          organizationId: scope.organization._id,
          workspaceId,
          createdBy: actor.userId,
          creationKey: input.creationKey,
        })
          .select('+requestDigest')
          .session(session)
      if (existing) {
        if (existing.requestDigest !== digest)
          throw conflict('Creation key already used for other details.')
        return projectDto(existing)
      }
      if (
        (await models.Project.countDocuments({
          workspaceId,
          organizationId: scope.organization._id,
        }).session(session)) >= 1000
      )
        throw conflict('Workspace project limit reached.')
      const [project] = await models.Project.create(
        [
          {
            ...input,
            ...dateFields(input),
            organizationId: scope.organization._id,
            workspaceId,
            ownerUserId: actor.userId,
            createdBy: actor.userId,
            requestDigest: digest,
          },
        ],
        { session },
      )
      await models.ProjectMembership.create(
        [{ ...scoped(project!), userId: actor.userId, role: 'MANAGER' }],
        { session },
      )
      await event(actor, project!, 'project.created', session)
      return projectDto(project!)
    })
  }
  async function project(actor: AuthContext, ws: string, id: string) {
    const data = await access(actor, ws, id)
    const names = await users([data.project.ownerUserId])
    const [totalTasks, completedTasks] = await Promise.all([
      models.Task.countDocuments({ ...scoped(data.project), archivedAt: null }),
      models.Task.countDocuments({ ...scoped(data.project), archivedAt: null, status: 'done' }),
    ])
    return {
      ...projectDto(data.project),
      totalTasks,
      completedTasks,
      owner: names.get(String(data.project.ownerUserId)),
      permissions: data.permissions,
    }
  }
  async function updateProject(actor: AuthContext, ws: string, id: string, input: S.ProjectUpdate) {
    return projectWrite(
      actor,
      ws,
      id,
      'manage',
      async (p, _permissions, session) => {
        if (input.version !== p.version) throw conflict()
        const { version: _version, ownerUserId, ...updates } = input
        void _version
        if (p.status === 'archived' && (!input.status || input.status === 'archived'))
          throw conflict('Restore before editing an archived project.')
        if (
          input.status &&
          input.status !== p.status &&
          !projectTransitions[p.status].includes(input.status)
        )
          throw conflict('Invalid project status transition.')
        if (input.status === 'archived') Object.assign(updates, { previousStatus: p.status })
        if (ownerUserId) {
          await eligible(actor, p, ownerUserId, session, true)
          await models.ProjectMembership.updateOne(
            { ...scoped(p), userId: ownerUserId },
            { $set: { role: 'MANAGER', status: 'active' } },
            { session, upsert: true, runValidators: true },
          )
          Object.assign(updates, { ownerUserId })
        }
        const start = updates.startDate === undefined ? p.startDate : updates.startDate,
          end = updates.dueDate === undefined ? p.dueDate : updates.dueDate
        if (start && end && new Date(start) > new Date(end))
          throw new ApiError(422, 'VALIDATION_FAILED', 'Invalid date range.')
        const row = await models.Project.findOneAndUpdate(
          { _id: id, workspaceId: ws, organizationId: p.organizationId },
          { $set: updates },
          { session, returnDocument: 'after', runValidators: true },
        )
        await event(
          actor,
          p,
          input.status === 'archived' ? 'project.archived' : 'project.updated',
          session,
          undefined,
          { fields: Object.keys(updates) },
        )
        return projectDto(row!)
      },
      true,
    )
  }
  async function members(actor: AuthContext, ws: string, id: string, input: S.PageQuery) {
    const { project } = await access(actor, ws, id)
    const rows = await models.ProjectMembership.find({
      ...scoped(project),
      status: 'active',
      ...cursorFilter(input, 'createdAt'),
    })
      .sort({ createdAt: -1, _id: -1 })
      .limit(input.limit + 1)
    const states = await workspaceMemberStates(
      project,
      rows.map((r) => r.userId),
    )
    return result(rows, input, 'createdAt', (row) => {
      const state = states.get(String(row.userId))
      return {
        id: String(row._id),
        userId: String(row.userId),
        role: row.role,
        name: state?.person?.name ?? 'Unavailable account',
        eligible:
          !!state?.active &&
          projectCapabilities(
            state.role!,
            row.role,
            String(project.ownerUserId) === String(row.userId),
          ).contribute,
      }
    })
  }
  async function member(
    actor: AuthContext,
    ws: string,
    id: string,
    input: { userId: string; role?: string; version: number },
  ) {
    return projectWrite(actor, ws, id, 'manage', async (p, _permissions, session) => {
      if (input.version !== p.version) throw conflict()
      if (String(p.ownerUserId) === input.userId)
        throw conflict('Transfer project ownership before changing its membership.')
      if (input.role) {
        const existing = await models.ProjectMembership.exists({
          ...scoped(p),
          userId: input.userId,
        }).session(session)
        if (
          !existing &&
          (await models.ProjectMembership.countDocuments({
            ...scoped(p),
            status: 'active',
          }).session(session)) >= 1000
        )
          throw conflict('Project membership limit reached.')
        const target = await context({ ...actor, userId: input.userId }, ws, session)
        const account = await authModels.User.exists({
          _id: input.userId,
          accountStatus: 'active',
          emailVerifiedAt: { $ne: null },
        }).session(session)
        if (!account) throw denied()
        if (
          input.role === 'MANAGER' &&
          !['OWNER', 'ADMIN', 'MANAGER'].includes(target.workspaceRole!)
        )
          throw denied()
        if (input.role === 'CONTRIBUTOR' && target.workspaceRole === 'VIEWER') throw denied()
        await models.ProjectMembership.updateOne(
          { ...scoped(p), userId: input.userId },
          { $set: { role: input.role, status: 'active' } },
          { session, upsert: true, runValidators: true },
        )
      } else {
        const row = await models.ProjectMembership.updateOne(
          { ...scoped(p), userId: input.userId, status: 'active' },
          { $set: { status: 'revoked' } },
          { session },
        )
        if (!row.matchedCount) throw hidden()
        await models.Task.updateMany(
          { ...scoped(p), assigneeId: input.userId },
          { $set: { assigneeId: null }, $inc: { version: 1 } },
          { session },
        )
      }
      await event(
        actor,
        p,
        input.role ? 'project.member_changed' : 'project.member_removed',
        session,
      )
      return { updated: true }
    })
  }
  async function visibleProjects(actor: AuthContext, ws: string) {
    const scope = await context(actor, ws)
    if (['OWNER', 'ADMIN'].includes(scope.workspaceRole!)) return { scope, filter: {}, grants: [] }
    const grants = await models.ProjectMembership.find({
      organizationId: scope.organization._id,
      workspaceId: ws,
      userId: actor.userId,
      status: 'active',
    })
      .select('projectId role')
      .limit(1000)
    return {
      scope,
      grants,
      filter: {
        $or: [{ _id: { $in: grants.map((g) => g.projectId) } }, { ownerUserId: actor.userId }],
      },
    }
  }
  async function tasks(actor: AuthContext, ws: string, input: S.TaskQuery, projectId?: string) {
    const visible = await visibleProjects(actor, ws)
    if (projectId) await access(actor, ws, projectId)
    const projectRows = await models.Project.find({
      organizationId: visible.scope.organization._id,
      workspaceId: ws,
      ...visible.filter,
      ...(projectId || input.projectId ? { _id: projectId ?? input.projectId } : {}),
      ...(input.archived === 'false' ? { status: { $ne: 'archived' } } : {}),
    })
      .select('_id name status ownerUserId')
      .limit(1000)
    const filter = {
      organizationId: visible.scope.organization._id,
      workspaceId: ws,
      projectId: { $in: projectRows.map((p) => p._id) },
      ...(input.archived === 'all'
        ? {}
        : { archivedAt: input.archived === 'true' ? { $ne: null } : null }),
      ...(input.parentTaskId ? { parentTaskId: input.parentTaskId } : {}),
      ...(input.status ? { status: input.status } : {}),
      ...(input.priority ? { priority: input.priority } : {}),
      ...(input.assigneeId
        ? {
            assigneeId:
              input.assigneeId === 'me'
                ? actor.userId
                : input.assigneeId === 'unassigned'
                  ? null
                  : input.assigneeId,
          }
        : {}),
      ...(input.search ? { title: { $regex: escape(input.search), $options: 'i' } } : {}),
      ...(input.dueBefore || input.dueAfter
        ? {
            dueDate: {
              ...(input.dueBefore ? { $lte: new Date(input.dueBefore) } : {}),
              ...(input.dueAfter ? { $gte: new Date(input.dueAfter) } : {}),
            },
          }
        : {}),
      ...cursorFilter(input, input.sort),
    }
    const rows = await models.Task.find(filter)
        .sort({
          [input.sort]: input.sort === 'dueDate' ? 1 : -1,
          _id: input.sort === 'dueDate' ? 1 : -1,
        })
        .limit(input.limit + 1),
      names = await users(
        rows.flatMap((t) => [t.createdBy, ...(t.assigneeId ? [t.assigneeId] : [])]),
      )
    return result(rows, input, input.sort, (t) => {
      const p = projectRows.find((p) => String(p._id) === String(t.projectId)),
        g = visible.grants.find((g) => String(g.projectId) === String(t.projectId))
      return {
        ...taskDto(t),
        assignee: t.assigneeId ? names.get(String(t.assigneeId)) : null,
        reporter: names.get(String(t.createdBy)),
        projectName: p?.name,
        canEdit:
          !t.archivedAt &&
          p?.status !== 'archived' &&
          projectCapabilities(
            visible.scope.workspaceRole!,
            g?.role,
            String(p?.ownerUserId) === actor.userId,
          ).contribute,
      }
    })
  }
  async function taskRecord(p: Project, id: string, session?: ClientSession) {
    const row = await models.Task.findOne({ ...scoped(p), _id: id }).session(session ?? null)
    if (!row) throw hidden()
    return row
  }
  async function task(actor: AuthContext, ws: string, projectId: string, id: string) {
    const data = await access(actor, ws, projectId),
      row = await taskRecord(data.project, id)
    const names = await users([row.createdBy, ...(row.assigneeId ? [row.assigneeId] : [])])
    let assigneeEligible = true
    if (row.assigneeId) {
      const states = await workspaceMemberStates(data.project, [row.assigneeId])
      const member = await models.ProjectMembership.findOne({
        ...scoped(data.project),
        userId: row.assigneeId,
        status: 'active',
      }).select('role')
      const state = states.get(String(row.assigneeId))
      assigneeEligible =
        !!state?.active &&
        projectCapabilities(
          state.role!,
          member?.role,
          String(data.project.ownerUserId) === String(row.assigneeId),
        ).contribute
    }
    const subtasks = await models.Task.aggregate<{ _id: null; total: number; done: number }>([
      { $match: { ...scoped(data.project), parentTaskId: row._id, archivedAt: null } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          done: { $sum: { $cond: [{ $eq: ['$status', 'done'] }, 1, 0] } },
        },
      },
    ])
    return {
      ...taskDto(row),
      assigneeEligible,
      permissions: data.permissions,
      assignee: row.assigneeId ? names.get(String(row.assigneeId)) : null,
      reporter: names.get(String(row.createdBy)),
      subtasks: subtasks[0] ?? { total: 0, done: 0 },
    }
  }
  async function rebalance(
    p: Project,
    status: Task['status'],
    parentTaskId: Types.ObjectId | null,
    session: ClientSession,
  ) {
    const rows = await models.Task.find({ ...scoped(p), status, parentTaskId, archivedAt: null })
      .sort({ position: 1, _id: 1 })
      .limit(10000)
      .session(session)
    if (!rows.length) return
    await models.Task.bulkWrite(
      rows.map((r, i) => ({
        updateOne: {
          filter: { ...scoped(p), _id: r._id },
          update: { $set: { position: -(i + 1) } },
        },
      })),
      { session },
    )
    await models.Task.bulkWrite(
      rows.map((r, i) => ({
        updateOne: {
          filter: { ...scoped(p), _id: r._id },
          update: { $set: { position: (i + 1) * 1024 } },
        },
      })),
      { session },
    )
  }
  async function position(
    p: Project,
    status: Task['status'],
    parent: Types.ObjectId | null,
    beforeId: string | null,
    exclude: Types.ObjectId | undefined,
    session: ClientSession,
  ): Promise<number> {
    const filter = {
      ...scoped(p),
      status,
      parentTaskId: parent,
      archivedAt: null,
      ...(exclude ? { _id: { $ne: exclude } } : {}),
    }
    let upper: number, lower: number
    if (beforeId) {
      if (beforeId === String(exclude)) throw conflict('Choose another destination.')
      const before = await models.Task.findOne({ ...filter, _id: beforeId }).session(session)
      if (!before) throw conflict('The destination changed. Refresh the board.')
      upper = before.position
      lower =
        (
          await models.Task.findOne({ ...filter, position: { $lt: upper } })
            .sort({ position: -1 })
            .session(session)
        )?.position ?? 0
    } else {
      lower =
        (await models.Task.findOne(filter).sort({ position: -1 }).session(session))?.position ?? 0
      upper = lower + 2048
    }
    if (upper - lower <= 1 || !Number.isSafeInteger(upper)) {
      await rebalance(p, status, parent, session)
      return position(p, status, parent, beforeId, exclude, session)
    }
    return lower + Math.floor((upper - lower) / 2)
  }
  async function createTask(
    actor: AuthContext,
    ws: string,
    projectId: string,
    input: S.TaskCreate,
  ) {
    return projectWrite(actor, ws, projectId, 'contribute', async (p, _permissions, session) => {
      const digest = tokenHash(JSON.stringify(input)),
        existing = await models.Task.findOne({
          ...scoped(p),
          createdBy: actor.userId,
          creationKey: input.creationKey,
        })
          .select('+requestDigest')
          .session(session)
      if (existing) {
        if (existing.requestDigest !== digest) throw conflict('Creation key already used.')
        return taskDto(existing)
      }
      if ((await models.Task.countDocuments(scoped(p)).session(session)) >= 10000)
        throw conflict('Project task limit reached.')
      if (input.parentTaskId) {
        const parent = await taskRecord(p, input.parentTaskId, session)
        if (parent.parentTaskId || parent.archivedAt)
          throw new ApiError(
            422,
            'VALIDATION_FAILED',
            'Choose an active top-level parent in this project.',
          )
      }
      if (input.assigneeId) await eligible(actor, p, input.assigneeId, session)
      const rank = await position(
        p,
        input.status,
        input.parentTaskId ? new Types.ObjectId(input.parentTaskId) : null,
        null,
        undefined,
        session,
      )
      const [row] = await models.Task.create(
        [
          {
            ...input,
            ...dateFields(input),
            ...scoped(p),
            createdBy: actor.userId,
            requestDigest: digest,
            position: rank,
            completedAt: input.status === 'done' ? now() : null,
          },
        ],
        { session },
      )
      await event(actor, p, 'task.created', session, row!._id)
      return taskDto(row!)
    })
  }
  async function updateTask(
    actor: AuthContext,
    ws: string,
    projectId: string,
    id: string,
    input: S.TaskUpdate,
    move?: { boardVersion: number; beforeId: string | null },
  ) {
    return projectWrite(actor, ws, projectId, 'contribute', async (p, _permissions, session) => {
      const row = await taskRecord(p, id, session)
      if (row.version !== input.version || (move && move.boardVersion !== p.version))
        throw conflict()
      if (row.archivedAt && input.archived !== false)
        throw conflict('Restore this task before editing.')
      if (row.parentTaskId) {
        const parent = await taskRecord(p, String(row.parentTaskId), session)
        if (parent.archivedAt) throw conflict('Restore the parent task first.')
      }
      const { version: _version, archived, ...updates } = input
      void _version
      if (input.assigneeId) await eligible(actor, p, input.assigneeId, session)
      const status = input.status ?? row.status
      const changes = {
        ...updates,
        ...(input.status
          ? { completedAt: status === 'done' ? (row.completedAt ?? now()) : null }
          : {}),
        ...(archived !== undefined ? { archivedAt: archived ? now() : null } : {}),
        ...(move || status !== row.status || archived === false
          ? {
              position: await position(
                p,
                status,
                row.parentTaskId ?? null,
                move?.beforeId ?? null,
                row._id,
                session,
              ),
            }
          : {}),
      }
      const start = input.startDate === undefined ? row.startDate : input.startDate,
        end = input.dueDate === undefined ? row.dueDate : input.dueDate
      if (start && end && new Date(start) > new Date(end))
        throw new ApiError(422, 'VALIDATION_FAILED', 'Invalid date range.')
      const saved = await models.Task.findOneAndUpdate(
        { ...scoped(p), _id: id, version: input.version },
        { $set: changes, $inc: { version: 1 } },
        { session, returnDocument: 'after', runValidators: true },
      )
      if (!saved) throw conflict()
      if (archived === true && !row.parentTaskId)
        await models.Task.updateMany(
          { ...scoped(p), parentTaskId: row._id, archivedAt: null },
          { $set: { archivedAt: now() }, $inc: { version: 1 } },
          { session },
        )
      const action =
        archived === true
          ? 'task.archived'
          : archived === false
            ? 'task.restored'
            : status !== row.status
              ? status === 'done'
                ? 'task.completed'
                : 'task.status_changed'
              : input.assigneeId !== undefined
                ? 'task.assigned'
                : input.priority
                  ? 'task.priority_changed'
                  : input.dueDate !== undefined
                    ? 'task.due_date_changed'
                    : move
                      ? 'task.reordered'
                      : 'task.updated'
      await event(actor, p, action, session, row._id, {
        fields: Object.keys(changes),
        from: row.status,
        to: status,
      })
      return taskDto(saved)
    })
  }
  async function board(
    actor: AuthContext,
    ws: string,
    projectId: string,
    input: { limit: number; status?: string | undefined; cursor?: number | undefined },
  ) {
    const data = await access(actor, ws, projectId)
    const columns = []
    for (const status of taskStatuses.filter((s) => !input.status || s === input.status)) {
      const rows = await models.Task.find({
        ...scoped(data.project),
        parentTaskId: null,
        archivedAt: null,
        status,
        ...(input.cursor !== undefined ? { position: { $gt: input.cursor } } : {}),
      })
        .sort({ position: 1, _id: 1 })
        .limit(input.limit + 1)
      const count = await models.Task.countDocuments({
        ...scoped(data.project),
        parentTaskId: null,
        archivedAt: null,
        status,
      })
      columns.push({
        status,
        items: rows.slice(0, input.limit).map(taskDto),
        total: count,
        nextCursor: rows.length > input.limit ? rows[input.limit - 1]!.position : null,
      })
    }
    const people = await users(
      columns.flatMap((column) =>
        column.items.flatMap((t) => (t.assigneeId ? [new Types.ObjectId(t.assigneeId)] : [])),
      ),
    )
    return {
      version: data.project.version,
      readOnly: data.project.status === 'archived' || !data.permissions.contribute,
      columns: columns.map((column) => ({
        ...column,
        items: column.items.map((t) => ({
          ...t,
          assignee: t.assigneeId ? people.get(t.assigneeId) : null,
        })),
      })),
    }
  }
  async function comments(
    actor: AuthContext,
    ws: string,
    projectId: string,
    taskId: string,
    input: S.PageQuery,
  ) {
    const { project } = await access(actor, ws, projectId)
    await taskRecord(project, taskId)
    const rows = await models.Comment.find({
      ...scoped(project),
      taskId,
      deletedAt: null,
      ...cursorFilter(input, 'createdAt'),
    })
      .sort({ createdAt: -1, _id: -1 })
      .limit(input.limit + 1)
    const names = await users(rows.map((r) => r.authorId))
    return result(rows, input, 'createdAt', (r) => ({
      id: String(r._id),
      authorId: String(r.authorId),
      author: names.get(String(r.authorId)),
      text: r.text,
      version: r.version,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    }))
  }
  async function comment(
    actor: AuthContext,
    ws: string,
    projectId: string,
    taskId: string,
    input: { text?: string; creationKey?: string; version?: number },
    id?: string,
  ) {
    return projectWrite(actor, ws, projectId, 'contribute', async (p, permissions, session) => {
      const task = await taskRecord(p, taskId, session)
      if (task.archivedAt) throw conflict('Restore this task before commenting.')
      if (!id) {
        if (!input.text || !input.creationKey)
          throw new ApiError(
            422,
            'VALIDATION_FAILED',
            'Comment text and creation key are required.',
          )
        const digest = tokenHash(input.text!),
          old = await models.Comment.findOne({
            ...scoped(p),
            taskId,
            authorId: actor.userId,
            creationKey: input.creationKey,
          })
            .select('+requestDigest')
            .session(session)
        if (old) {
          if (old.requestDigest !== digest) throw conflict()
          return { id: String(old._id) }
        }
        const [row] = await models.Comment.create(
          [
            {
              ...scoped(p),
              taskId,
              authorId: actor.userId,
              text: input.text!,
              creationKey: input.creationKey!,
              requestDigest: digest,
            },
          ],
          { session },
        )
        await event(actor, p, 'comment.added', session, task._id)
        return { id: String(row!._id) }
      }
      const row = await models.Comment.findOne({
        ...scoped(p),
        taskId,
        _id: id,
        deletedAt: null,
      }).session(session)
      if (!row) throw hidden()
      if (String(row.authorId) !== actor.userId && !permissions.moderate) throw denied()
      if (row.version !== input.version) throw conflict()
      await models.Comment.updateOne(
        { ...scoped(p), taskId, _id: id, version: input.version },
        {
          $set:
            input.text !== undefined
              ? { text: input.text }
              : { text: '[deleted]', deletedAt: now() },
          $inc: { version: 1 },
        },
        { session, runValidators: true },
      )
      await event(
        actor,
        p,
        input.text !== undefined ? 'comment.edited' : 'comment.deleted',
        session,
        task._id,
      )
      return { updated: true }
    })
  }
  async function activity(
    actor: AuthContext,
    ws: string,
    projectId: string,
    input: S.PageQuery,
    taskId?: string,
  ) {
    const { project } = await access(actor, ws, projectId)
    if (taskId) await taskRecord(project, taskId)
    const rows = await models.Activity.find({
      ...scoped(project),
      ...(taskId ? { taskId } : {}),
      ...cursorFilter(input, 'createdAt'),
    })
      .sort({ createdAt: -1, _id: -1 })
      .limit(input.limit + 1)
    const names = await users(rows.map((r) => r.actorId))
    return result(rows, input, 'createdAt', (r) => ({
      id: String(r._id),
      taskId: r.taskId ? String(r.taskId) : null,
      actor: names.get(String(r.actorId)),
      action: r.action,
      metadata: r.metadata,
      createdAt: r.createdAt.toISOString(),
    }))
  }
  async function dashboard(actor: AuthContext, ws: string) {
    const visible = await visibleProjects(actor, ws),
      rows = await models.Project.find({
        organizationId: visible.scope.organization._id,
        workspaceId: ws,
        ...visible.filter,
        status: { $ne: 'archived' },
      })
        .select('_id name status updatedAt dueDate')
        .sort({ updatedAt: -1, _id: -1 })
        .limit(1000),
      ids = rows.map((p) => p._id),
      filter = {
        organizationId: visible.scope.organization._id,
        workspaceId: new Types.ObjectId(ws),
        projectId: { $in: ids },
        archivedAt: null,
      }
    const aggregate = await models.Task.aggregate<{
      _id: null
      total: number
      todo: number
      inProgress: number
      done: number
      overdue: number
      mine: number
    }>([
      { $match: filter },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          todo: { $sum: { $cond: [{ $eq: ['$status', 'todo'] }, 1, 0] } },
          inProgress: { $sum: { $cond: [{ $eq: ['$status', 'in_progress'] }, 1, 0] } },
          done: { $sum: { $cond: [{ $eq: ['$status', 'done'] }, 1, 0] } },
          overdue: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $ne: ['$status', 'done'] },
                    { $ne: ['$dueDate', null] },
                    { $lt: ['$dueDate', new Date(now().toISOString().slice(0, 10))] },
                  ],
                },
                1,
                0,
              ],
            },
          },
          mine: {
            $sum: { $cond: [{ $eq: ['$assigneeId', new Types.ObjectId(actor.userId)] }, 1, 0] },
          },
        },
      },
    ])
    const upcoming = await models.Task.find({
      ...filter,
      status: { $ne: 'done' },
      dueDate: {
        $gte: new Date(now().toISOString().slice(0, 10)),
        $lte: new Date(+now() + 14 * 86400000),
      },
    })
      .sort({ dueDate: 1, _id: 1 })
      .limit(10)
    return {
      totalProjects: rows.length,
      activeProjects: rows.filter((p) => p.status === 'active').length,
      tasks: aggregate[0] ?? { total: 0, todo: 0, inProgress: 0, done: 0, overdue: 0, mine: 0 },
      upcoming: upcoming.map(taskDto),
      recentProjects: rows.slice(0, 5).map((p) => ({
        id: String(p._id),
        name: p.name,
        status: p.status,
        updatedAt: p.updatedAt.toISOString(),
      })),
    }
  }
  return {
    projects,
    access,
    createProject,
    project,
    updateProject,
    members,
    member,
    tasks,
    task,
    createTask,
    updateTask,
    board,
    comments,
    comment,
    activity,
    dashboard,
  }
}
export type WorkService = ReturnType<typeof createWorkService>
