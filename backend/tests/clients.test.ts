import { beforeAll, beforeEach, afterAll, describe, it, expect, vi } from 'vitest'
import { randomUUID } from 'node:crypto'
import { Types } from 'mongoose'
import {
  createAuthFixture,
  verifiedBrowser,
  browser,
  testIdentity,
  type AuthFixture,
} from './auth-fixture.js'
import { ensureClientIndexes, clientIndexesReady } from '../src/modules/clients/client.models.js'
let f: AuthFixture
async function call(
  c: ReturnType<typeof browser>,
  method: 'get' | 'post' | 'patch',
  path: string,
  body?: object,
) {
  const csrf = await c.csrf()
  const r = c.agent[method]('/api/v1' + path)
    .set('Origin', 'http://localhost:5173')
    .set('X-CSRF-Token', csrf)
  return body ? r.send(body) : r
}
async function user(email: string) {
  const u = browser(f.app())
  await u.post('register', { ...testIdentity, email })
  await u.post('verify-email', { token: f.token('verify-email') })
  expect((await u.post('login', { email, password: testIdentity.password })).status).toBe(200)
  return u
}
async function setup() {
  const a = await verifiedBrowser(f)
  const o = await call(a, 'post', '/organizations', {
    name: 'Agency',
    slug: 'agency',
    workspaceName: 'Delivery',
    workspaceSlug: 'delivery',
    creationKey: randomUUID(),
  })
  expect(o.status).toBe(201)
  const ws = String(o.body.data.workspace.id),
    root = `/workspaces/${ws}/clients`
  const p = await call(a, 'post', `/workspaces/${ws}/projects`, {
    name: 'Internal confidential title',
    slug: 'private-project',
    description: 'Private notes never for clients',
    creationKey: randomUUID(),
  })
  expect(p.status).toBe(201)
  const c = await call(a, 'post', root, {
    name: 'Retail',
    status: 'active',
    creationKey: randomUUID(),
  })
  expect(c.status).toBe(201)
  const id = String(c.body.data.id),
    path = root + '/' + id,
    pid = String(p.body.data.id)
  const contact = await call(a, 'post', path + '/contacts', {
    name: 'Client Person',
    email: 'portal@example.com',
    primary: true,
  })
  expect(contact.status).toBe(201)
  return {
    a,
    ws,
    org: String(o.body.data.organization.id),
    root,
    id,
    path,
    pid,
    contact: String(contact.body.data.id),
  }
}
async function grant(x: Awaited<ReturnType<typeof setup>>, extra: object = {}) {
  const r = await call(x.a, 'post', x.path + '/projects', {
    projectId: x.pid,
    title: 'Approved public title',
    description: 'Approved overview',
    progress: true,
    milestones: true,
    deliverables: true,
    feedback: true,
    changes: true,
    approve: true,
    ...extra,
  })
  expect(r.status).toBe(201)
  return r.body.data
}
async function invite(x: Awaited<ReturnType<typeof setup>>, role = 'CLIENT_MEMBER') {
  const r = await call(x.a, 'post', x.path + '/invitations', { contactId: x.contact, role })
  expect(r.status).toBe(201)
  await f.clients!.drainMail()
  return { token: f.token('invitation'), id: String(r.body.data.id) }
}
async function external(x: Awaited<ReturnType<typeof setup>>, role = 'CLIENT_MEMBER') {
  const u = await user('portal@example.com')
  const i = await invite(x, role)
  expect((await call(u, 'post', '/portal/invitations/accept', { token: i.token })).status).toBe(200)
  return u
}
async function resource(x: Awaited<ReturnType<typeof setup>>, kind: string, extra: object = {}) {
  const r = await call(x.a, 'post', x.path + '/projects/' + x.pid + '/resources', {
    kind,
    title: 'Client record',
    body: 'Plain text',
    creationKey: randomUUID(),
    ...extra,
  })
  expect(r.status).toBe(201)
  return r.body.data as { id: string; version: number; status: string }
}
const externalRoot = (x: Awaited<ReturnType<typeof setup>>) =>
  `/portal/clients/${x.id}/projects/${x.pid}`
describe('Phase 7 client isolation, collaboration and decisions', () => {
  it('prevents staff from rewriting a recorded client approval note', async () => {
    const x = await setup()
    await grant(x)
    const u = await external(x),
      d = await resource(x, 'deliverable')
    const path = x.path + '/projects/' + x.pid + '/resources/' + d.id
    await call(x.a, 'patch', path, { version: 1, status: 'shared' })
    expect(
      (
        await call(u, 'patch', externalRoot(x) + '/resources/' + d.id, {
          version: 2,
          status: 'approved',
          decisionNote: 'Client decision retained',
        })
      ).status,
    ).toBe(200)
    expect(
      (await call(x.a, 'patch', path, { version: 3, decisionNote: 'Overwritten by agency' }))
        .status,
    ).toBe(409)
    expect((await f.clientModels!.Resource.findById(d.id))!.decisionNote).toBe(
      'Client decision retained',
    )
  })
  it('orders milestones with stable bounded cursor pages after reordering', async () => {
    const x = await setup()
    await grant(x)
    const u = await external(x)
    await resource(x, 'milestone', { title: 'Later milestone', position: 20, published: true })
    await resource(x, 'milestone', { title: 'Earlier milestone', position: 10, published: true })
    const path = externalRoot(x) + '/resources?kind=milestone&sort=position&limit=1'
    const first = await call(u, 'get', path)
    expect(first.body.data.items[0].title).toBe('Earlier milestone')
    const second = await call(u, 'get', path + '&cursor=' + first.body.data.nextCursor)
    expect(second.body.data.items[0].title).toBe('Later milestone')
  })
  it('never exposes shared replies beneath an unpublished feedback thread', async () => {
    const x = await setup()
    await grant(x)
    const u = await external(x)
    const feedback = await resource(x, 'feedback', { published: false })
    await resource(x, 'reply', {
      parentId: feedback.id,
      published: true,
      body: 'Must stay concealed',
    })
    expect(
      (await call(u, 'get', externalRoot(x) + '/resources?kind=reply&parentId=' + feedback.id))
        .status,
    ).toBe(404)
    expect((await call(u, 'get', externalRoot(x) + '/resources?kind=reply')).status).toBe(404)
    expect(
      JSON.stringify((await call(u, 'get', externalRoot(x) + '/resources')).body),
    ).not.toContain('Must stay concealed')
  })
  it('conceals archived clients without deleting their publication history', async () => {
    const x = await setup()
    await grant(x)
    const u = await external(x)
    await resource(x, 'milestone', { published: true })
    await call(x.a, 'patch', x.path, { version: 1, status: 'archived' })
    expect((await call(u, 'get', externalRoot(x))).status).toBe(404)
    expect(await f.clientModels!.Resource.countDocuments({ clientId: x.id })).toBe(1)
    await call(x.a, 'patch', x.path, { version: 2, status: 'active' })
    expect((await call(u, 'get', externalRoot(x))).status).toBe(200)
  })
  it('requires a live authorized issuer at invitation acceptance', async () => {
    const x = await setup(),
      u = await user('portal@example.com'),
      i = await invite(x)
    await f.models.User.updateOne(
      { email: testIdentity.email },
      { $set: { accountStatus: 'disabled' } },
    )
    expect((await call(u, 'post', '/portal/invitations/accept', { token: i.token })).status).toBe(
      410,
    )
    expect(await f.clientModels!.Membership.countDocuments()).toBe(0)
  })
  it('prevents contacts from a different client being invited or edited', async () => {
    const x = await setup()
    const second = await call(x.a, 'post', x.root, {
      name: 'Separate client',
      status: 'active',
      creationKey: randomUUID(),
    })
    const path = x.root + '/' + second.body.data.id
    expect(
      (
        await call(x.a, 'post', path + '/invitations', {
          contactId: x.contact,
          role: 'CLIENT_MEMBER',
        })
      ).status,
    ).toBe(404)
    expect(
      (await call(x.a, 'patch', path + '/contacts/' + x.contact, { version: 1, name: 'Attack' }))
        .status,
    ).toBe(404)
  })
  it('does not upgrade an existing active portal membership through invitation replay', async () => {
    const x = await setup()
    const u = await external(x, 'CLIENT_VIEWER')
    expect(
      (
        await call(x.a, 'post', x.path + '/invitations', {
          contactId: x.contact,
          role: 'CLIENT_ADMIN',
        })
      ).status,
    ).toBe(409)
    const memberships = await call(u, 'get', `/portal/clients/${x.id}/members`)
    expect(memberships.body.data.items[0].role).toBe('CLIENT_VIEWER')
  })
  it('serializes membership revocation before later client writes', async () => {
    const x = await setup()
    await grant(x)
    const u = await external(x)
    const members = await call(x.a, 'get', x.path + '/members'),
      m = members.body.data.items[0]
    expect(
      (
        await call(x.a, 'patch', x.path + '/members/' + m.id, {
          version: m.version,
          status: 'revoked',
        })
      ).status,
    ).toBe(200)
    expect(
      (
        await call(u, 'post', externalRoot(x) + '/resources', {
          kind: 'feedback',
          title: 'Stale access',
          creationKey: randomUUID(),
        })
      ).status,
    ).toBe(404)
  })
  it('prevents internal VIEWER and MEMBER roles from managing CRM or portal grants', async () => {
    const x = await setup()
    const u = await user('staff@example.com')
    expect(
      (
        await call(x.a, 'post', '/organizations/' + x.org + '/invitations', {
          email: 'staff@example.com',
          organizationRole: 'MEMBER',
          targets: [{ workspaceId: x.ws, role: 'MEMBER' }],
        })
      ).status,
    ).toBe(201)
    await f.tenants!.drainMail()
    expect(
      (await call(u, 'post', '/invitations/accept', { token: f.token('invitation') })).status,
    ).toBe(200)
    expect((await call(u, 'get', x.root)).status).toBe(403)
    expect(
      (await call(u, 'post', x.path + '/projects', { projectId: x.pid, title: 'Escalation' }))
        .status,
    ).toBe(403)
  })
  it('rejects unknown fields, forged ownership and malformed pagination', async () => {
    const x = await setup()
    expect(
      (
        await call(x.a, 'post', x.root, {
          name: 'Forged',
          organizationId: x.org,
          creationKey: randomUUID(),
        })
      ).status,
    ).toBe(422)
    expect(
      (await call(x.a, 'patch', x.path, { version: 1, ownerId: String(new Types.ObjectId()) }))
        .status,
    ).toBe(404)
    expect((await call(x.a, 'get', x.root + '?limit=1000')).status).toBe(422)
    expect((await call(x.a, 'get', x.root + '?status=invalid')).status).toBe(422)
  })
  it('allows empty dashboards and persists no invented progress or approval counts', async () => {
    const x = await setup(),
      u = await external(x)
    const r = await call(u, 'get', `/portal/clients/${x.id}`)
    expect(r.body.data.sharedProjects).toBe(0)
    expect(r.body.data.pendingApprovals).toBe(0)
    expect(r.body.data.recentUpdates).toEqual([])
  })
  beforeAll(async () => {
    f = await createAuthFixture({ clients: true })
  }, 90000)
  beforeEach(async () => f.reset())
  afterAll(async () => f.close())
  it('initializes additive indexes idempotently in the isolated database', async () => {
    await ensureClientIndexes(f.clientModels!)
    expect(await clientIndexesReady(f.clientModels!)).toBe(true)
  })
  it('creates, searches, paginates, edits, archives and restores clients without deleting work', async () => {
    const x = await setup()
    await call(x.a, 'post', x.root, { name: 'Second customer', creationKey: randomUUID() })
    const first = await call(x.a, 'get', x.root + '?limit=1')
    expect(first.body.data.hasMore).toBe(true)
    expect(
      (await call(x.a, 'get', x.root + '?cursor=' + first.body.data.nextCursor)).body.data.items,
    ).toHaveLength(1)
    expect((await call(x.a, 'get', x.root + '?search=Retail')).body.data.items).toHaveLength(1)
    expect((await call(x.a, 'get', x.root + '?search=%2E%2A')).body.data.items).toHaveLength(0)
    expect((await call(x.a, 'patch', x.path, { version: 1, status: 'archived' })).status).toBe(200)
    expect((await call(x.a, 'patch', x.path, { version: 2, status: 'active' })).status).toBe(200)
    expect(await f.workModels!.Project.countDocuments()).toBe(1)
  })
  it('supports retry keys and rejects changed input for the same creation key', async () => {
    const x = await setup(),
      body = { name: 'Retry client', creationKey: randomUUID() }
    const r = await Promise.all([call(x.a, 'post', x.root, body), call(x.a, 'post', x.root, body)])
    expect(r.map((i) => i.status)).toEqual([201, 201])
    expect(r[0]!.body.data.id).toBe(r[1]!.body.data.id)
    expect((await call(x.a, 'post', x.root, { ...body, name: 'Changed' })).status).toBe(409)
  })
  it('normalizes contacts, rejects duplicates, and maintains one primary contact', async () => {
    const x = await setup()
    expect(
      (
        await call(x.a, 'post', x.path + '/contacts', {
          name: 'Duplicate',
          email: 'PORTAL@example.com',
        })
      ).status,
    ).toBe(409)
    expect(
      (
        await call(x.a, 'post', x.path + '/contacts', {
          name: 'Other',
          email: 'other@example.com',
          primary: true,
        })
      ).status,
    ).toBe(201)
    expect(await f.clientModels!.Contact.countDocuments({ clientId: x.id, primary: true })).toBe(1)
    expect(
      (
        await call(x.a, 'patch', x.path + '/contacts/' + x.contact, {
          version: 2,
          title: 'Founder',
        })
      ).status,
    ).toBe(200)
  })
  it('accepts existing verified identities without creating employee memberships', async () => {
    const x = await setup(),
      u = await external(x)
    expect(await f.tenantModels!.OrganizationMembership.countDocuments()).toBe(1)
    expect(await f.tenantModels!.WorkspaceMembership.countDocuments()).toBe(1)
    expect((await call(u, 'get', '/portal/clients')).body.data.items).toHaveLength(1)
    expect((await call(u, 'get', `/workspaces/${x.ws}/projects/${x.pid}`)).status).toBe(404)
    expect((await call(u, 'get', x.path)).status).toBe(404)
  })
  it('stores only token hashes and previews without recipient addresses', async () => {
    const x = await setup(),
      i = await invite(x)
    const doc = await f.clientModels!.Invitation.findById(i.id).select('+tokenHash')
    expect(doc!.tokenHash).not.toBe(i.token)
    const r = await call(x.a, 'post', '/portal/invitations/preview', { token: i.token })
    expect(r.status).toBe(200)
    expect(JSON.stringify(r.body)).not.toContain('portal@example.com')
    expect(f.logging.lines.join('')).not.toContain(i.token)
  })
  it('rejects wrong-email acceptance, replay and simultaneous duplicate acceptance', async () => {
    const x = await setup(),
      u = await user('portal@example.com'),
      i = await invite(x)
    expect((await call(x.a, 'post', '/portal/invitations/accept', { token: i.token })).status).toBe(
      403,
    )
    const r = await Promise.all([
      call(u, 'post', '/portal/invitations/accept', { token: i.token }),
      call(u, 'post', '/portal/invitations/accept', { token: i.token }),
    ])
    expect(r.map((v) => v.status).sort()).toEqual([200, 410])
    expect(await f.clientModels!.Membership.countDocuments()).toBe(1)
  })
  it('rejects expired invitations without relying on TTL cleanup', async () => {
    const x = await setup(),
      i = await invite(x)
    f.advance(73 * 3600000)
    expect(
      (await call(x.a, 'post', '/portal/invitations/preview', { token: i.token })).status,
    ).toBe(410)
  })
  it('revokes invitations and applies resend cooldown with token replacement', async () => {
    const x = await setup(),
      i = await invite(x)
    expect((await call(x.a, 'post', x.path + '/invitations/' + i.id + '/resend', {})).status).toBe(
      409,
    )
    f.advance(61000)
    expect((await call(x.a, 'post', x.path + '/invitations/' + i.id + '/resend', {})).status).toBe(
      200,
    )
    expect(
      (await call(x.a, 'post', '/portal/invitations/preview', { token: i.token })).status,
    ).toBe(410)
    await f.clients!.drainMail()
    const next = f.token('invitation')
    expect((await call(x.a, 'post', x.path + '/invitations/' + i.id + '/revoke', {})).status).toBe(
      200,
    )
    expect((await call(x.a, 'post', '/portal/invitations/preview', { token: next })).status).toBe(
      410,
    )
  })
  it('rejects duplicate pending invitation and invalid contacts', async () => {
    const x = await setup()
    await invite(x)
    expect(
      (
        await call(x.a, 'post', x.path + '/invitations', {
          contactId: x.contact,
          role: 'CLIENT_ADMIN',
        })
      ).status,
    ).toBe(409)
    expect(
      (
        await call(x.a, 'post', x.path + '/invitations', {
          contactId: String(new Types.ObjectId()),
          role: 'CLIENT_MEMBER',
        })
      ).status,
    ).toBe(404)
  })
  it('delivers only explicit safe project fields, not internal project documents', async () => {
    const x = await setup()
    await grant(x)
    const u = await external(x)
    const r = await call(u, 'get', externalRoot(x))
    expect(r.status).toBe(200)
    expect(r.body.data.project.title).toBe('Approved public title')
    expect(JSON.stringify(r.body)).not.toMatch(
      /Private notes|Internal confidential|ownerUserId|createdBy|organizationId|workspaceId/,
    )
    expect(Object.keys(r.body.data.project).sort()).toEqual(
      [
        'id',
        'version',
        'projectId',
        'title',
        'description',
        'status',
        'progress',
        'milestones',
        'deliverables',
        'feedback',
        'changes',
        'approve',
      ].sort(),
    )
  })
  it('hides unshared projects and immediately enforces grant revocation', async () => {
    const x = await setup(),
      u = await external(x)
    expect((await call(u, 'get', externalRoot(x))).status).toBe(404)
    await grant(x)
    expect((await call(u, 'get', externalRoot(x))).status).toBe(200)
    await call(x.a, 'patch', x.path + '/projects/' + x.pid, { version: 1, status: 'revoked' })
    expect((await call(u, 'get', externalRoot(x))).status).toBe(404)
    expect((await call(u, 'get', `/portal/clients/${x.id}`)).body.data.sharedProjects).toBe(0)
  })
  it('rejects cross-client reads/writes even when projects belong to one workspace', async () => {
    const x = await setup()
    await grant(x)
    const u = await external(x)
    const other = await call(x.a, 'post', x.root, {
      name: 'Other client',
      status: 'active',
      creationKey: randomUUID(),
    })
    const id = other.body.data.id
    expect((await call(u, 'get', `/portal/clients/${id}`)).status).toBe(404)
    expect(
      (
        await call(u, 'post', `/portal/clients/${id}/projects/${x.pid}/resources`, {
          kind: 'feedback',
          title: 'Attack',
          creationKey: randomUUID(),
        })
      ).status,
    ).toBe(404)
  })
  it('rejects foreign tenant project sharing and CRM access', async () => {
    const x = await setup(),
      u = await user('foreign@example.com')
    const org = await call(u, 'post', '/organizations', {
      name: 'Other agency',
      slug: 'other-agency',
      workspaceName: 'Other work',
      workspaceSlug: 'other',
      creationKey: randomUUID(),
    })
    const ws = org.body.data.workspace.id
    const p = await call(u, 'post', `/workspaces/${ws}/projects`, {
      name: 'Foreign project',
      slug: 'foreign-project',
      creationKey: randomUUID(),
    })
    expect(
      (
        await call(x.a, 'post', x.path + '/projects', {
          projectId: p.body.data.id,
          title: 'Attack',
        })
      ).status,
    ).toBe(404)
    expect((await call(u, 'patch', x.path, { version: 1, name: 'Attack' })).status).toBe(404)
  })
  it('publishes progress and milestones explicitly, excluding drafts and internal tasks', async () => {
    const x = await setup()
    await grant(x)
    const u = await external(x),
      p = await resource(x, 'progress', { progress: 35 }),
      m = await resource(x, 'milestone')
    const root = x.path + '/projects/' + x.pid + '/resources'
    expect((await call(u, 'get', externalRoot(x) + '/resources')).body.data.items).toHaveLength(0)
    await call(x.a, 'patch', root + '/' + p.id, { version: 1, status: 'published' })
    await call(x.a, 'patch', root + '/' + m.id, {
      version: 1,
      published: true,
      status: 'in_progress',
    })
    const r = await call(u, 'get', externalRoot(x) + '/resources')
    expect(r.body.data.items).toHaveLength(2)
    expect(r.body.data.items[0].progress).toBe(35)
    expect(JSON.stringify(r.body)).not.toMatch(/createdBy|taskId|decisionBy/)
    expect((await call(u, 'get', `/portal/clients/${x.id}`)).body.data.recentUpdates).toHaveLength(
      1,
    )
  })
  it('enforces per-grant visibility independently of membership role', async () => {
    const x = await setup()
    await grant(x, { feedback: false, progress: false })
    const u = await external(x, 'CLIENT_ADMIN')
    expect((await call(u, 'get', externalRoot(x) + '/resources?kind=progress')).status).toBe(404)
    expect(
      (
        await call(u, 'post', externalRoot(x) + '/resources', {
          kind: 'feedback',
          title: 'Forbidden',
          creationKey: randomUUID(),
        })
      ).status,
    ).toBe(403)
  })
  it.each(['feedback', 'change', 'progress', 'deliverable', 'milestone'])(
    'keeps CLIENT_VIEWER read only for %s',
    async (kind) => {
      const x = await setup()
      await grant(x)
      const u = await external(x, 'CLIENT_VIEWER')
      expect(
        (
          await call(u, 'post', externalRoot(x) + '/resources', {
            kind,
            title: 'Forbidden',
            creationKey: randomUUID(),
          })
        ).status,
      ).toBe(403)
    },
  )
  it('allows feedback, safe shared replies and agency resolution without exposing internal notes', async () => {
    const x = await setup()
    await grant(x)
    const u = await external(x),
      root = externalRoot(x) + '/resources'
    const r = await call(u, 'post', root, {
      kind: 'feedback',
      title: 'Design feedback',
      body: '<script>plain text</script>',
      creationKey: randomUUID(),
    })
    expect(r.status).toBe(201)
    await resource(x, 'reply', {
      parentId: r.body.data.id,
      published: false,
      body: 'Internal-only note',
    })
    await resource(x, 'reply', {
      parentId: r.body.data.id,
      published: true,
      body: 'Agency response',
    })
    const replies = await call(u, 'get', root + '?kind=reply&parentId=' + r.body.data.id)
    expect(replies.body.data.items).toHaveLength(1)
    expect(replies.body.data.items[0].body).toBe('Agency response')
    expect(
      (
        await call(x.a, 'patch', x.path + '/projects/' + x.pid + '/resources/' + r.body.data.id, {
          version: 1,
          status: 'resolved',
        })
      ).status,
    ).toBe(200)
  })
  it('requires reviewed change transitions and authorized same-project task linking', async () => {
    const x = await setup()
    await grant(x)
    const u = await external(x),
      r = await call(u, 'post', externalRoot(x) + '/resources', {
        kind: 'change',
        title: 'Add payment method',
        creationKey: randomUUID(),
      })
    const path = x.path + '/projects/' + x.pid + '/resources/' + r.body.data.id
    expect((await call(x.a, 'patch', path, { version: 1, status: 'approved' })).status).toBe(409)
    expect((await call(x.a, 'patch', path, { version: 1, status: 'under_review' })).status).toBe(
      200,
    )
    expect(
      (
        await call(x.a, 'patch', path, {
          version: 2,
          status: 'approved',
          decisionNote: 'Approved for next release',
        })
      ).status,
    ).toBe(200)
    const task = await call(x.a, 'post', `/workspaces/${x.ws}/projects/${x.pid}/tasks`, {
      title: 'Internal implementation',
      creationKey: randomUUID(),
    })
    expect((await call(x.a, 'patch', path, { version: 3, taskId: task.body.data.id })).status).toBe(
      200,
    )
    expect(
      (
        await call(u, 'patch', externalRoot(x) + '/resources/' + r.body.data.id, {
          version: 4,
          status: 'completed',
        })
      ).status,
    ).toBe(403)
    const list = await call(u, 'get', externalRoot(x) + '/resources?kind=change')
    expect(JSON.stringify(list.body)).not.toContain(task.body.data.id)
  })
  it('preserves approval metadata across supersession and rejects duplicate or stale decisions', async () => {
    const x = await setup()
    await grant(x)
    const u = await external(x),
      d = await resource(x, 'deliverable', { url: 'https://example.com/design' }),
      internal = x.path + '/projects/' + x.pid + '/resources/' + d.id,
      externalPath = externalRoot(x) + '/resources/' + d.id
    expect((await call(x.a, 'patch', internal, { version: 1, status: 'shared' })).status).toBe(200)
    expect((await call(u, 'get', `/portal/clients/${x.id}`)).body.data.pendingApprovals).toBe(1)
    const decisions = await Promise.all([
      call(u, 'patch', externalPath, { version: 2, status: 'approved', decisionNote: 'Accepted' }),
      call(u, 'patch', externalPath, { version: 2, status: 'changes_requested' }),
    ])
    expect(decisions.map((r) => r.status).sort()).toEqual([200, 409])
    const next = await resource(x, 'deliverable', {
      previousId: d.id,
      url: 'https://example.com/design-v2',
    })
    expect(next.status).toBe('draft')
    const old = await f.clientModels!.Resource.findById(d.id)
    expect(old!.status).toBe('superseded')
    expect(old!.decisionAt).not.toBeNull()
    expect((await call(u, 'patch', externalPath, { version: 4, status: 'approved' })).status).toBe(
      404,
    )
  })
  it('denies approval without grant permission and forbids staff approval impersonation', async () => {
    const x = await setup()
    await grant(x, { approve: false })
    const u = await external(x),
      d = await resource(x, 'deliverable')
    await call(x.a, 'patch', x.path + '/projects/' + x.pid + '/resources/' + d.id, {
      version: 1,
      status: 'shared',
    })
    expect(
      (
        await call(u, 'patch', externalRoot(x) + '/resources/' + d.id, {
          version: 2,
          status: 'approved',
        })
      ).status,
    ).toBe(403)
    expect(
      (
        await call(x.a, 'patch', x.path + '/projects/' + x.pid + '/resources/' + d.id, {
          version: 2,
          status: 'approved',
        })
      ).status,
    ).toBe(403)
  })
  it.each([
    'javascript:alert(1)',
    'file:///C:/private',
    'http://example.com',
    'https://user:password@example.com',
    'https://127.0.0.1/private',
    'https://192.168.1.1/file',
  ])('rejects unsafe reference category %s', async (url) => {
    const x = await setup()
    await grant(x)
    expect(
      (
        await call(x.a, 'post', x.path + '/projects/' + x.pid + '/resources', {
          kind: 'deliverable',
          title: 'Unsafe reference',
          url,
          creationKey: randomUUID(),
        })
      ).status,
    ).toBe(422)
  })
  it('revokes portal access when contact, membership, client or project becomes unavailable', async () => {
    const x = await setup()
    await grant(x)
    const u = await external(x)
    await call(x.a, 'patch', x.path + '/contacts/' + x.contact, { version: 1, archived: true })
    expect((await call(u, 'get', externalRoot(x))).status).toBe(404)
    expect(await f.clientModels!.Membership.countDocuments({ status: 'active' })).toBe(0)
    expect((await call(u, 'get', '/portal/clients')).body.data.items).toHaveLength(0)
  })
  it('hides archived projects from dashboard and listing', async () => {
    const x = await setup()
    await grant(x)
    const u = await external(x)
    await call(x.a, 'patch', `/workspaces/${x.ws}/projects/${x.pid}`, {
      version: 1,
      status: 'archived',
    })
    expect((await call(u, 'get', externalRoot(x))).status).toBe(404)
    expect((await call(u, 'get', `/portal/clients/${x.id}`)).body.data.sharedProjects).toBe(0)
    expect((await call(u, 'get', `/portal/clients/${x.id}/projects`)).body.data.items).toHaveLength(
      0,
    )
  })
  it('rejects role escalation and self-management by a portal administrator', async () => {
    const x = await setup()
    await grant(x)
    const u = await external(x, 'CLIENT_ADMIN'),
      m = await f.clientModels!.Membership.findOne({ clientId: x.id })
    expect(
      (
        await call(u, 'patch', `/portal/clients/${x.id}/members/${m!._id}`, {
          version: 1,
          role: 'CLIENT_MEMBER',
        })
      ).status,
    ).toBe(403)
    expect(
      (await call(u, 'patch', x.path, { version: 1, allowRepresentatives: true })).status,
    ).toBe(404)
  })
  it('rejects stale sessions and validates CSRF on portal mutations', async () => {
    const x = await setup()
    await grant(x)
    const u = await external(x)
    const noCsrf = await u.agent
      .post('/api/v1' + externalRoot(x) + '/resources')
      .set('Origin', 'http://localhost:5173')
      .send({ kind: 'feedback', title: 'Attack', creationKey: randomUUID() })
    expect(noCsrf.status).toBe(403)
    await u.post('logout')
    expect((await call(u, 'get', externalRoot(x))).status).toBe(401)
  })
  it('rolls back business changes when atomic audit insertion fails', async () => {
    const x = await setup()
    const spy = vi
      .spyOn(f.clientModels!.Audit, 'create')
      .mockRejectedValueOnce(new Error('Isolated audit failure'))
    try {
      expect(
        (await call(x.a, 'patch', x.path, { version: 1, name: 'Must roll back' })).status,
      ).toBe(500)
      expect((await f.clientModels!.Client.findById(x.id))!.name).toBe('Retail')
    } finally {
      spy.mockRestore()
    }
  })
})
