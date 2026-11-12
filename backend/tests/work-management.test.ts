import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { randomUUID } from 'node:crypto'
import { Types } from 'mongoose'
import {
  createAuthFixture,
  verifiedBrowser,
  browser,
  testIdentity,
  type AuthFixture,
} from './auth-fixture.js'
import { projectCapabilities } from '../src/modules/memberships/permissions.js'
let f: AuthFixture
const wsRoot = (ws: string) => '/workspaces/' + ws
const root = (ws: string, p: string) => wsRoot(ws) + '/projects/' + p
async function call(
  c: ReturnType<typeof browser>,
  method: 'get' | 'post' | 'patch' | 'delete',
  path: string,
  body?: object,
) {
  const token = await c.csrf()
  const q = c.agent[method]('/api/v1' + path)
    .set('Origin', 'http://localhost:5173')
    .set('X-CSRF-Token', token)
  return body ? q.send(body) : q
}
async function user(email: string) {
  const c = browser(f.app())
  await c.post('register', { ...testIdentity, email })
  await c.post('verify-email', { token: f.token('verify-email') })
  const r = await c.post('login', { email, password: testIdentity.password })
  expect(r.status).toBe(200)
  return { ...c, userId: String(r.body.data.user.id) }
}
async function setup(slug = 'solar-company') {
  const owner = await verifiedBrowser(f)
  const org = await call(owner, 'post', '/organizations', {
    name: 'Hans Solar',
    slug,
    workspaceName: 'Solar Operations',
    workspaceSlug: 'operations',
    creationKey: randomUUID(),
  })
  expect(org.status).toBe(201)
  return {
    owner,
    ws: String(org.body.data.workspace.id),
    org: String(org.body.data.organization.id),
  }
}
async function project(c: ReturnType<typeof browser>, ws: string, slug = 'solar-project') {
  const r = await call(c, 'post', wsRoot(ws) + '/projects', {
    name: 'Solar Project',
    slug,
    creationKey: randomUUID(),
  })
  expect(r.status).toBe(201)
  return r.body.data as { id: string; version: number }
}
async function task(c: ReturnType<typeof browser>, ws: string, p: string, extra: object = {}) {
  const r = await call(c, 'post', root(ws, p) + '/tasks', {
    title: 'First task',
    creationKey: randomUUID(),
    ...extra,
  })
  expect(r.status).toBe(201)
  return r.body.data as { id: string; version: number; status: string; position: number }
}
async function member(
  owner: ReturnType<typeof browser>,
  org: string,
  ws: string,
  email: string,
  role = 'MEMBER',
) {
  const c = await user(email)
  const r = await call(owner, 'post', '/organizations/' + org + '/invitations', {
    email,
    organizationRole: 'MEMBER',
    targets: [{ workspaceId: ws, role }],
  })
  expect(r.status).toBe(201)
  await f.tenants!.drainMail()
  expect(
    (await call(c, 'post', '/invitations/accept', { token: f.token('invitation') })).status,
  ).toBe(200)
  return c
}
async function grant(
  owner: ReturnType<typeof browser>,
  ws: string,
  p: string,
  userId: string,
  role: string,
) {
  const current = await call(owner, 'get', root(ws, p))
  return call(owner, 'post', root(ws, p) + '/members', {
    userId,
    role,
    version: current.body.data.version,
  })
}
describe('Phase 6 persisted work and tenant boundaries', () => {
  beforeAll(async () => {
    f = await createAuthFixture({ work: true })
  }, 90000)
  beforeEach(async () => f.reset())
  afterAll(async () => f.close())
  it('creates projects atomically with manager grant and activity, and retries without duplicates', async () => {
    const { owner, ws } = await setup(),
      body = { name: 'Solar project', slug: 'solar-project', creationKey: randomUUID() }
    const responses = await Promise.all([
      call(owner, 'post', wsRoot(ws) + '/projects', body),
      call(owner, 'post', wsRoot(ws) + '/projects', body),
    ])
    expect(responses.map((r) => r.status)).toEqual([201, 201])
    expect(responses[0]!.body.data.id).toBe(responses[1]!.body.data.id)
    expect(await f.workModels!.Project.countDocuments()).toBe(1)
    expect(await f.workModels!.ProjectMembership.countDocuments()).toBe(1)
    expect(await f.workModels!.Activity.countDocuments({ action: 'project.created' })).toBe(1)
    expect(
      (await call(owner, 'post', wsRoot(ws) + '/projects', { ...body, name: 'Other' })).status,
    ).toBe(409)
    expect(
      (await call(owner, 'post', wsRoot(ws) + '/projects', { ...body, creationKey: randomUUID() }))
        .status,
    ).toBe(409)
    expect(JSON.stringify(responses[0]!.body)).not.toMatch(/requestDigest|password|token/)
  })
  it.each([
    { name: '' },
    { slug: 'invalid space' },
    { organizationId: new Types.ObjectId().toString() },
    { ownerUserId: new Types.ObjectId().toString() },
    { dueDate: '2026-02-30' },
    { startDate: '2026-12-30', dueDate: '2026-12-01' },
  ])('rejects invalid or forged project fields %j', async (fields) => {
    const { owner, ws } = await setup()
    expect(
      (
        await call(owner, 'post', wsRoot(ws) + '/projects', {
          name: 'Project',
          slug: 'project-example',
          creationKey: randomUUID(),
          ...fields,
        })
      ).status,
    ).toBe(422)
    expect(await f.workModels!.Project.countDocuments()).toBe(0)
  })
  it('enforces project access for workspace members and owner/admin inheritance', async () => {
    const { owner, ws, org } = await setup(),
      p = await project(owner, ws),
      c = await member(owner, org, ws, 'member@example.com')
    expect((await call(c, 'get', wsRoot(ws) + '/projects')).body.data.items).toEqual([])
    expect((await call(c, 'get', root(ws, p.id))).status).toBe(404)
    expect(
      (
        await call(c, 'post', wsRoot(ws) + '/projects', {
          name: 'Escalation',
          slug: 'escalation',
          creationKey: randomUUID(),
        })
      ).status,
    ).toBe(403)
    expect((await grant(owner, ws, p.id, c.userId, 'CONTRIBUTOR')).status).toBe(200)
    expect((await call(c, 'get', root(ws, p.id))).status).toBe(200)
    await task(c, ws, p.id)
    const current = (await call(c, 'get', root(ws, p.id))).body.data
    expect(
      (await call(c, 'patch', root(ws, p.id), { name: 'Denied', version: current.version })).status,
    ).toBe(403)
    expect((await grant(owner, ws, p.id, c.userId, 'MANAGER')).status).toBe(403)
  })
  it('manager grants administer only their projects; transfer preserves ownership and target eligibility', async () => {
    const { owner, ws, org } = await setup(),
      a = await project(owner, ws),
      b = await project(owner, ws, 'other-project'),
      m = await member(owner, org, ws, 'manager@example.com', 'MANAGER')
    expect((await grant(owner, ws, a.id, m.userId, 'MANAGER')).status).toBe(200)
    expect((await call(m, 'get', root(ws, b.id))).status).toBe(404)
    const current = (await call(owner, 'get', root(ws, a.id))).body.data
    expect(
      (
        await call(owner, 'patch', root(ws, a.id), {
          ownerUserId: m.userId,
          version: current.version,
        })
      ).status,
    ).toBe(200)
    const after = (await call(owner, 'get', root(ws, a.id))).body.data
    expect(
      (
        await call(owner, 'delete', root(ws, a.id) + '/members/' + m.userId, {
          version: after.version,
        })
      ).status,
    ).toBe(409)
    expect(
      (await call(m, 'patch', root(ws, a.id), { name: 'Managed project', version: after.version }))
        .status,
    ).toBe(200)
  })
  it('viewer ceiling prevents mutation even with a stale stronger grant and revoked membership takes effect', async () => {
    const { owner, ws, org } = await setup(),
      p = await project(owner, ws),
      c = await member(owner, org, ws, 'member@example.com')
    await grant(owner, ws, p.id, c.userId, 'CONTRIBUTOR')
    const t = await task(c, ws, p.id)
    const membership = await f.tenantModels!.WorkspaceMembership.findOne({
      workspaceId: ws,
      userId: c.userId,
    })
    await f.tenantModels!.WorkspaceMembership.updateOne(
      { _id: membership!._id },
      { $set: { role: 'VIEWER' } },
    )
    expect(
      (
        await call(c, 'patch', root(ws, p.id) + '/tasks/' + t.id, {
          version: t.version,
          status: 'done',
        })
      ).status,
    ).toBe(403)
    expect((await call(c, 'get', root(ws, p.id))).status).toBe(200)
    await call(owner, 'delete', '/workspaces/' + ws + '/members/' + String(membership!._id))
    expect((await call(c, 'get', root(ws, p.id))).status).toBe(404)
  })
  it('protects all resources, comments, dashboard and assignments from another company', async () => {
    const { owner, ws } = await setup(),
      p = await project(owner, ws),
      t = await task(owner, ws, p.id),
      outsider = await user('outside@example.com')
    const other = await call(outsider, 'post', '/organizations', {
        name: 'Creative Agency',
        slug: 'creative-agency',
        workspaceName: 'Client Projects',
        workspaceSlug: 'client-projects',
        creationKey: randomUUID(),
      }),
      otherWs = String(other.body.data.workspace.id)
    for (const path of [
      root(ws, p.id),
      root(ws, p.id) + '/tasks/' + t.id,
      root(ws, p.id) + '/board',
      root(ws, p.id) + '/activity',
      root(ws, p.id) + '/tasks/' + t.id + '/comments',
      wsRoot(ws) + '/dashboard',
    ])
      expect((await call(outsider, 'get', path)).status).toBe(404)
    expect(
      (
        await call(owner, 'patch', root(ws, p.id) + '/tasks/' + t.id, {
          version: 1,
          assigneeId: outsider.userId,
        })
      ).status,
    ).toBe(422)
    expect((await call(owner, 'get', root(otherWs, p.id))).status).toBe(404)
    expect(
      (await call(outsider, 'get', wsRoot(otherWs) + '/dashboard')).body.data.totalProjects,
    ).toBe(0)
  })
  it('creates, assigns, edits, filters and paginates tasks with strict dates and stale versions', async () => {
    const { owner, ws, org } = await setup(),
      p = await project(owner, ws),
      c = await member(owner, org, ws, 'member@example.com')
    expect(
      (
        await call(owner, 'post', root(ws, p.id) + '/tasks', {
          title: 'Task',
          creationKey: randomUUID(),
          assigneeId: c.userId,
        })
      ).status,
    ).toBe(422)
    await grant(owner, ws, p.id, c.userId, 'CONTRIBUTOR')
    const t = await task(owner, ws, p.id, {
      title: 'Needle task',
      assigneeId: c.userId,
      dueDate: '2026-12-01',
      priority: 'urgent',
    })
    await task(owner, ws, p.id, { title: 'Another task', dueDate: null })
    const changed = await call(c, 'patch', root(ws, p.id) + '/tasks/' + t.id, {
      version: 1,
      status: 'done',
      description: 'Plain text',
      labels: ['review'],
    })
    expect(changed.status).toBe(200)
    expect(changed.body.data.completedAt).toBeTruthy()
    expect(
      (await call(c, 'patch', root(ws, p.id) + '/tasks/' + t.id, { version: 1, priority: 'low' }))
        .status,
    ).toBe(409)
    const filtered = await call(
      c,
      'get',
      wsRoot(ws) +
        '/tasks?search=Needle&status=done&priority=urgent&assigneeId=me&dueBefore=2026-12-02',
    )
    expect(filtered.body.data.items.map((r: { id: string }) => r.id)).toEqual([t.id])
    const first = await call(owner, 'get', root(ws, p.id) + '/tasks?limit=1&sort=dueDate')
    expect(first.body.data.hasMore).toBe(true)
    const next = await call(
      owner,
      'get',
      root(ws, p.id) +
        '/tasks?limit=1&sort=dueDate&cursor=' +
        encodeURIComponent(String(first.body.data.nextCursor)),
    )
    expect(next.body.data.items).toHaveLength(1)
    expect(next.body.data.items[0].id).not.toBe(first.body.data.items[0].id)
    expect(
      (
        await call(owner, 'patch', root(ws, p.id) + '/tasks/' + t.id, {
          version: 2,
          dueDate: '2026-02-30',
        })
      ).status,
    ).toBe(422)
    expect(
      (
        await call(owner, 'patch', root(ws, p.id) + '/tasks/' + t.id, {
          version: 2,
          assigneeId: null,
        })
      ).status,
    ).toBe(200)
  })
  it.each([
    { title: '' },
    { title: 'x'.repeat(201) },
    { status: 'evil' },
    { priority: 'normal' },
    { parentTaskId: 'bad' },
    { dueDate: 'not a date' },
    { createdBy: new Types.ObjectId().toString() },
  ])('validates task payload %j', async (fields) => {
    const { owner, ws } = await setup(),
      p = await project(owner, ws)
    expect(
      (
        await call(owner, 'post', root(ws, p.id) + '/tasks', {
          title: 'Task',
          creationKey: randomUUID(),
          ...fields,
        })
      ).status,
    ).toBe(422)
  })
  it('persists moves and reordering and rejects concurrent stale board revisions', async () => {
    const { owner, ws } = await setup(),
      p = await project(owner, ws),
      a = await task(owner, ws, p.id, { title: 'Task A' }),
      b = await task(owner, ws, p.id, { title: 'Task B' })
    let board = (await call(owner, 'get', root(ws, p.id) + '/board')).body.data
    expect(
      (
        await call(owner, 'patch', root(ws, p.id) + '/tasks/' + b.id + '/move', {
          version: 1,
          boardVersion: board.version,
          status: 'todo',
          beforeId: a.id,
        })
      ).status,
    ).toBe(200)
    board = (await call(owner, 'get', root(ws, p.id) + '/board')).body.data
    expect(board.columns[0].items.map((r: { id: string }) => r.id)).toEqual([b.id, a.id])
    const results = await Promise.all([
      call(owner, 'patch', root(ws, p.id) + '/tasks/' + a.id + '/move', {
        version: 1,
        boardVersion: board.version,
        status: 'done',
      }),
      call(owner, 'patch', root(ws, p.id) + '/tasks/' + b.id + '/move', {
        version: 2,
        boardVersion: board.version,
        status: 'in_progress',
      }),
    ])
    expect(results.map((r) => r.status).sort()).toEqual([200, 409])
    const persisted = (await call(owner, 'get', root(ws, p.id) + '/board')).body.data
    expect(persisted.columns.flatMap((c: { items: unknown[] }) => c.items)).toHaveLength(2)
  })
  it('rebalances exhausted position gaps transactionally and paginates columns', async () => {
    const { owner, ws } = await setup(),
      p = await project(owner, ws),
      a = await task(owner, ws, p.id),
      b = await task(owner, ws, p.id)
    await f.workModels!.Task.updateOne({ _id: a.id }, { $set: { position: 1 } })
    await f.workModels!.Task.updateOne({ _id: b.id }, { $set: { position: 2 } })
    const c = await task(owner, ws, p.id)
    const board = (await call(owner, 'get', root(ws, p.id) + '/board')).body.data
    expect(
      (
        await call(owner, 'patch', root(ws, p.id) + '/tasks/' + c.id + '/move', {
          version: 1,
          boardVersion: board.version,
          status: 'todo',
          beforeId: b.id,
        })
      ).status,
    ).toBe(200)
    const first = (await call(owner, 'get', root(ws, p.id) + '/board?limit=1&status=todo')).body
      .data.columns[0]
    expect(first.nextCursor).toBeTruthy()
    const next = (
      await call(
        owner,
        'get',
        root(ws, p.id) + '/board?limit=1&status=todo&cursor=' + String(first.nextCursor),
      )
    ).body.data.columns[0]
    expect(next.items[0].id).toBe(c.id)
    const rows = await f.workModels!.Task.find({ projectId: p.id })
    expect(new Set(rows.map((r) => r.position)).size).toBe(3)
    expect(rows.every((r) => r.position > 0)).toBe(true)
  })
  it('supports one-level subtasks, independent completion, and archive cascades without deletion', async () => {
    const { owner, ws } = await setup(),
      p = await project(owner, ws),
      parent = await task(owner, ws, p.id),
      child = await task(owner, ws, p.id, { parentTaskId: parent.id })
    expect(
      (
        await call(owner, 'post', root(ws, p.id) + '/tasks', {
          title: 'Nested',
          creationKey: randomUUID(),
          parentTaskId: child.id,
        })
      ).status,
    ).toBe(422)
    await call(owner, 'patch', root(ws, p.id) + '/tasks/' + child.id, {
      version: 1,
      status: 'done',
    })
    const otherProject = await project(owner, ws, 'another-project')
    expect(
      (
        await call(owner, 'post', root(ws, otherProject.id) + '/tasks', {
          title: 'Wrong parent',
          parentTaskId: parent.id,
          creationKey: randomUUID(),
        })
      ).status,
    ).toBe(404)
    const detail = (await call(owner, 'get', root(ws, p.id) + '/tasks/' + parent.id)).body.data
    expect(detail.subtasks).toMatchObject({ total: 1, done: 1 })
    expect(detail.status).toBe('todo')
    await call(owner, 'patch', root(ws, p.id) + '/tasks/' + parent.id, {
      version: 1,
      archived: true,
    })
    expect(await f.workModels!.Task.countDocuments()).toBe(2)
    expect((await call(owner, 'get', wsRoot(ws) + '/dashboard')).body.data.tasks.total).toBe(0)
    expect(
      (
        await call(owner, 'patch', root(ws, p.id) + '/tasks/' + child.id, {
          version: 3,
          archived: false,
        })
      ).status,
    ).toBe(409)
    expect(
      (
        await call(owner, 'patch', root(ws, p.id) + '/tasks/' + parent.id, {
          version: 2,
          archived: false,
        })
      ).status,
    ).toBe(200)
    expect(
      (
        await call(owner, 'patch', root(ws, p.id) + '/tasks/' + child.id, {
          version: 3,
          archived: false,
        })
      ).status,
    ).toBe(200)
  })
  it('persists plain-text comments, enforces author/moderator policy, and records atomic activity', async () => {
    const { owner, ws, org } = await setup(),
      p = await project(owner, ws),
      a = await member(owner, org, ws, 'a@example.com'),
      b = await member(owner, org, ws, 'b@example.com')
    await grant(owner, ws, p.id, a.userId, 'CONTRIBUTOR')
    await grant(owner, ws, p.id, b.userId, 'CONTRIBUTOR')
    const t = await task(a, ws, p.id),
      path = root(ws, p.id) + '/tasks/' + t.id + '/comments'
    const comment = await call(a, 'post', path, {
      text: '<script>controlled text</script>',
      creationKey: randomUUID(),
    })
    expect(comment.status).toBe(201)
    const id = String(comment.body.data.id)
    expect(
      (await call(b, 'patch', path + '/' + id, { text: 'Forged edit', version: 1 })).status,
    ).toBe(403)
    expect((await call(a, 'patch', path + '/' + id, { text: 'Edited', version: 1 })).status).toBe(
      200,
    )
    expect((await call(a, 'delete', path + '/' + id, { version: 1 })).status).toBe(409)
    expect((await call(owner, 'delete', path + '/' + id, { version: 2 })).status).toBe(200)
    expect((await call(a, 'get', path)).body.data.items).toEqual([])
    const history = await call(a, 'get', root(ws, p.id) + '/tasks/' + t.id + '/activity')
    expect(
      history.body.data.items.some((e: { action: string }) => e.action === 'comment.added'),
    ).toBe(true)
  })
  it('rolls back business writes when activity persistence fails', async () => {
    const { owner, ws } = await setup(),
      p = await project(owner, ws),
      original = f.workModels!.Activity.create
    f.workModels!.Activity.create = (() => {
      throw new Error('Controlled event write failure')
    }) as typeof original
    try {
      expect(
        (
          await call(owner, 'post', root(ws, p.id) + '/tasks', {
            title: 'Rollback',
            creationKey: randomUUID(),
          })
        ).status,
      ).toBe(500)
    } finally {
      f.workModels!.Activity.create = original
    }
    expect(await f.workModels!.Task.countDocuments()).toBe(0)
  })
  it('archives/restores projects without deleting tasks and reports real scoped metrics', async () => {
    const { owner, ws } = await setup(),
      p = await project(owner, ws),
      t = await task(owner, ws, p.id, { status: 'done' })
    let current = (await call(owner, 'get', root(ws, p.id))).body.data
    expect((await call(owner, 'get', wsRoot(ws) + '/dashboard')).body.data.tasks).toMatchObject({
      total: 1,
      done: 1,
    })
    expect(
      (await call(owner, 'patch', root(ws, p.id), { version: current.version, status: 'archived' }))
        .status,
    ).toBe(200)
    expect(
      (
        await call(owner, 'patch', root(ws, p.id) + '/tasks/' + t.id, {
          version: 1,
          status: 'todo',
        })
      ).status,
    ).toBe(409)
    expect((await call(owner, 'get', wsRoot(ws) + '/dashboard')).body.data.tasks.total).toBe(0)
    current = (await call(owner, 'get', root(ws, p.id))).body.data
    expect(
      (await call(owner, 'patch', root(ws, p.id), { version: current.version, status: 'planned' }))
        .status,
    ).toBe(200)
    expect((await call(owner, 'get', wsRoot(ws) + '/dashboard')).body.data.tasks.total).toBe(1)
  })
  it('preserves tenant constraints through cursors, disabled accounts, CSRF and invalid identifiers', async () => {
    const { owner, ws, org } = await setup(),
      a = await project(owner, ws),
      b = await project(owner, ws, 'private-project'),
      c = await member(owner, org, ws, 'member@example.com')
    await grant(owner, ws, a.id, c.userId, 'CONTRIBUTOR')
    const first = await call(owner, 'get', wsRoot(ws) + '/projects?limit=1')
    const listed = await call(
      c,
      'get',
      wsRoot(ws) + '/projects?limit=1&cursor=' + String(first.body.data.nextCursor),
    )
    expect(listed.body.data.items.every((p: { id: string }) => p.id !== b.id)).toBe(true)
    expect(
      (await owner.agent.post('/api/v1' + wsRoot(ws) + '/projects').send({ name: 'No CSRF' }))
        .status,
    ).toBe(403)
    expect((await call(owner, 'get', wsRoot(ws) + '/projects/not-an-id')).status).toBe(422)
    expect((await call(owner, 'get', wsRoot(ws) + '/projects?cursor=invalid')).status).toBe(422)
    await f.models.User.updateOne({ _id: c.userId }, { $set: { accountStatus: 'disabled' } })
    expect((await call(c, 'get', root(ws, a.id))).status).toBe(401)
  })
})
describe('project capabilities reuse workspace role ceilings', () => {
  it.each(['OWNER', 'ADMIN'] as const)('%s inherits scoped administration', (role) =>
    expect(projectCapabilities(role, undefined)).toMatchObject({
      read: true,
      manage: true,
      contribute: true,
    }),
  )
  it('requires manager grant, prevents member escalation and keeps viewers read-only', () => {
    expect(projectCapabilities('MANAGER', 'CONTRIBUTOR').manage).toBe(false)
    expect(projectCapabilities('MANAGER', 'MANAGER').manage).toBe(true)
    expect(projectCapabilities('MEMBER', 'MANAGER').manage).toBe(false)
    expect(projectCapabilities('VIEWER', 'CONTRIBUTOR').contribute).toBe(false)
  })
})

describe('Phase 6 boundary and load regressions', () => {
  beforeAll(async () => {
    f = await createAuthFixture({ work: true })
  }, 90000)
  beforeEach(async () => f.reset())
  afterAll(async () => f.close())
  it('preserves omitted PATCH fields and treats regex searches as literal text', async () => {
    const { owner, ws } = await setup(),
      p = await project(owner, ws)
    let detail = (await call(owner, 'get', root(ws, p.id))).body.data
    await call(owner, 'patch', root(ws, p.id), {
      version: detail.version,
      description: 'Retained description',
      priority: 'urgent',
    })
    detail = (await call(owner, 'get', root(ws, p.id))).body.data
    await call(owner, 'patch', root(ws, p.id), { version: detail.version, name: 'Changed name' })
    const updated = (await call(owner, 'get', root(ws, p.id))).body.data
    expect(updated.description).toBe('Retained description')
    expect(updated.priority).toBe('urgent')
    expect((await call(owner, 'get', wsRoot(ws) + '/projects?search=.*')).body.data.items).toEqual(
      [],
    )
    const a = await task(owner, ws, p.id, {
      description: 'Retained task description',
      priority: 'high',
    })
    await call(owner, 'patch', root(ws, p.id) + '/tasks/' + a.id, {
      version: 1,
      title: 'Only title changed',
    })
    const result = (await call(owner, 'get', root(ws, p.id) + '/tasks/' + a.id)).body.data
    expect(result.description).toBe('Retained task description')
    expect(result.priority).toBe('high')
    expect((await call(owner, 'get', root(ws, p.id) + '/tasks?search=.*')).body.data.items).toEqual(
      [],
    )
  })
  it('bounds board/list pages and aggregates two hundred controlled tasks', async () => {
    const { owner, ws, org } = await setup(),
      p = await project(owner, ws),
      actor = String(owner.login.body.data.user.id),
      codes = ['todo', 'in_progress', 'in_review', 'done']
    await f.workModels!.Task.insertMany(
      Array.from({ length: 200 }, (_, index) => ({
        organizationId: org,
        workspaceId: ws,
        projectId: p.id,
        title: 'Boundary task ' + index,
        status: codes[index % 4],
        priority: 'medium',
        createdBy: actor,
        creationKey: randomUUID(),
        requestDigest: 'controlled-digest',
        position: (index + 1) * 1024,
        completedAt: index % 4 === 3 ? new Date() : null,
      })),
    )
    const board = (await call(owner, 'get', root(ws, p.id) + '/board')).body.data
    expect(
      board.columns.map((column: { items: unknown[]; total: number }) => [
        column.items.length,
        column.total,
      ]),
    ).toEqual([
      [20, 50],
      [20, 50],
      [20, 50],
      [20, 50],
    ])
    const list = (await call(owner, 'get', root(ws, p.id) + '/tasks?limit=50')).body.data
    expect(list.items).toHaveLength(50)
    expect(list.hasMore).toBe(true)
    expect((await call(owner, 'get', wsRoot(ws) + '/dashboard')).body.data.tasks).toMatchObject({
      total: 200,
      todo: 50,
      inProgress: 50,
      done: 50,
    })
  })
  it('marks revoked assignees ineligible without granting them access', async () => {
    const { owner, ws, org } = await setup(),
      p = await project(owner, ws),
      c = await member(owner, org, ws, 'assigned@example.com')
    await grant(owner, ws, p.id, c.userId, 'CONTRIBUTOR')
    const t = await task(owner, ws, p.id, { assigneeId: c.userId })
    const membership = await f.tenantModels!.WorkspaceMembership.findOne({
      workspaceId: ws,
      userId: c.userId,
    })
    await call(owner, 'delete', '/workspaces/' + ws + '/members/' + String(membership!._id))
    expect(
      (await call(owner, 'get', root(ws, p.id) + '/tasks/' + t.id)).body.data.assigneeEligible,
    ).toBe(false)
    expect((await call(c, 'get', root(ws, p.id) + '/tasks/' + t.id)).status).toBe(404)
    expect(
      (
        await call(owner, 'patch', root(ws, p.id) + '/tasks/' + t.id, {
          version: 1,
          assigneeId: c.userId,
        })
      ).status,
    ).toBe(422)
    expect(
      (
        await call(owner, 'patch', root(ws, p.id) + '/tasks/' + t.id, {
          version: 1,
          assigneeId: null,
        })
      ).status,
    ).toBe(200)
  })
})
