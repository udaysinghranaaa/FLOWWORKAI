import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { randomUUID } from 'node:crypto'
import { Types } from 'mongoose'
import {
  browser,
  createAuthFixture,
  testIdentity,
  verifiedBrowser,
  type AuthFixture,
} from './auth-fixture.js'
import {
  permissionMatrix,
  workspacePermissionMatrix,
  workspacePermissions,
} from '../src/modules/memberships/permissions.js'
import { tokenHash } from '../src/modules/auth/auth.crypto.js'
import { tenantIndexesReady } from '../src/modules/organizations/tenant.schema-initialization.js'

type Client = ReturnType<typeof browser>
let f: AuthFixture
const company = (slug = 'solar-company') => ({
  name: 'Hans Solar',
  slug,
  workspaceName: 'Solar Operations',
  workspaceSlug: 'operations',
  creationKey: randomUUID(),
})
async function api(
  client: Client,
  method: 'post' | 'patch' | 'delete' | 'get',
  path: string,
  body?: object,
) {
  const csrf = await client.csrf()
  const req = client.agent[method](`/api/v1${path}`)
    .set('Origin', 'http://localhost:5173')
    .set('X-CSRF-Token', csrf)
  return body ? req.send(body) : req
}
async function person(email: string) {
  const client = browser(f.app())
  await client.post('register', { ...testIdentity, email })
  await client.post('verify-email', { token: f.token('verify-email') })
  await client.post('login', { email, password: testIdentity.password })
  return client
}
async function onboard(client: Client, slug?: string) {
  const response = await api(client, 'post', '/organizations', company(slug))
  expect(response.status).toBe(201)
  return response.body.data as { organization: { id: string }; workspace: { id: string } }
}
async function invite(owner: Client, org: string, ws: string, email: string, role = 'MEMBER') {
  const response = await api(owner, 'post', `/organizations/${org}/invitations`, {
    email,
    organizationRole: 'MEMBER',
    targets: [{ workspaceId: ws, role }],
  })
  expect(response.status).toBe(201)
  await f.tenants!.drainMail()
  return { id: String(response.body.data.id), token: f.token('invitation'), response }
}

describe('tenant HTTP boundaries and transactions on an isolated replica set', () => {
  beforeAll(async () => {
    f = await createAuthFixture({ tenants: true })
  }, 90000)
  beforeEach(async () => {
    await f.reset()
  })
  afterAll(async () => {
    await f.close()
  })
  it('creates company, workspace and both owners atomically; identical retries are idempotent', async () => {
    const owner = await verifiedBrowser(f),
      input = company()
    const responses = await Promise.all([
      api(owner, 'post', '/organizations', input),
      api(owner, 'post', '/organizations', input),
    ])
    expect(responses.map((r) => r.status)).toEqual([201, 201])
    expect(responses[0]!.body.data).toEqual(responses[1]!.body.data)
    for (const model of [
      f.tenantModels!.Organization,
      f.tenantModels!.Workspace,
      f.tenantModels!.OrganizationMembership,
      f.tenantModels!.WorkspaceMembership,
    ])
      expect(await model.countDocuments()).toBe(1)
    expect(await tenantIndexesReady(f.tenantModels!)).toBe(true)
    expect((await api(owner, 'post', '/organizations', { ...input, name: 'Changed' })).status).toBe(
      409,
    )
    expect((await api(owner, 'post', '/organizations', company())).status).toBe(409)
    expect(await f.tenantModels!.Workspace.countDocuments()).toBe(1)
  })
  it('requires auth, CSRF and strict allowlists and rejects malformed IDs', async () => {
    const guest = browser(f.app())
    expect((await api(guest, 'post', '/organizations', company())).status).toBe(401)
    const owner = await verifiedBrowser(f)
    expect((await owner.agent.post('/api/v1/organizations').send(company())).status).toBe(403)
    expect(
      (await api(owner, 'post', '/organizations', { ...company(), role: 'OWNER' })).status,
    ).toBe(422)
    expect((await api(owner, 'get', '/workspaces/not-an-id')).status).toBe(422)
    expect((await api(owner, 'get', '/organizations?limit=999')).status).toBe(422)
  })
  it('conceals unrelated tenant IDs and protects scoped mutations', async () => {
    const a = await verifiedBrowser(f),
      b = await person('other@example.com')
    const first = await onboard(a),
      second = await onboard(b, 'creative-agency')
    for (const path of [
      `/organizations/${first.organization.id}`,
      `/workspaces/${first.workspace.id}`,
      `/workspaces/${first.workspace.id}/members`,
    ])
      expect((await api(b, 'get', path)).status).toBe(404)
    expect(
      (await api(a, 'get', '/me/workspaces')).body.data.items.map((w: { id: string }) => w.id),
    ).toEqual([first.workspace.id])
    expect(
      (await api(b, 'patch', `/workspaces/${first.workspace.id}`, { name: 'Stolen', version: 1 }))
        .status,
    ).toBe(404)
    expect(
      (
        await api(a, 'post', `/organizations/${first.organization.id}/invitations`, {
          email: 'x@example.com',
          organizationRole: 'MEMBER',
          targets: [{ workspaceId: second.workspace.id, role: 'ADMIN' }],
        })
      ).status,
    ).toBe(404)
  })
  it('accepts hashed invitations once with matching verified identity and no pending access', async () => {
    const owner = await verifiedBrowser(f),
      member = await person('member@example.com'),
      wrong = await person('wrong@example.com'),
      scope = await onboard(owner)
    const invitation = await invite(
      owner,
      scope.organization.id,
      scope.workspace.id,
      'member@example.com',
    )
    const row = await f.tenantModels!.Invitation.findById(invitation.id).select('+tokenHash')
    expect(row!.tokenHash).toBe(tokenHash(invitation.token))
    expect(JSON.stringify(invitation.response.body)).not.toMatch(
      /tokenHash|token|password|normalizedEmail/,
    )
    expect((await api(member, 'get', `/workspaces/${scope.workspace.id}`)).status).toBe(404)
    const preview = await api(browser(f.app()), 'post', '/invitations/preview', {
      token: invitation.token,
    })
    expect(preview.status).toBe(200)
    expect(JSON.stringify(preview.body)).not.toContain('member@example.com')
    expect(
      (await api(wrong, 'post', '/invitations/accept', { token: invitation.token })).status,
    ).toBe(403)
    const accepted = await Promise.all([
      api(member, 'post', '/invitations/accept', { token: invitation.token }),
      api(member, 'post', '/invitations/accept', { token: invitation.token }),
    ])
    expect(accepted.map((r) => r.status).sort()).toEqual([200, 410])
    expect((await api(member, 'get', `/workspaces/${scope.workspace.id}`)).body.data.role).toBe(
      'MEMBER',
    )
    expect(
      await f.tenantModels!.WorkspaceMembership.countDocuments({ workspaceId: scope.workspace.id }),
    ).toBe(2)
    expect(
      (await api(member, 'post', '/invitations/accept', { token: invitation.token })).status,
    ).toBe(410)
  })
  it('resends invalidate old links; revoked and expired invitations cannot be accepted', async () => {
    const owner = await verifiedBrowser(f),
      member = await person('member@example.com'),
      scope = await onboard(owner)
    const invitation = await invite(
      owner,
      scope.organization.id,
      scope.workspace.id,
      'member@example.com',
    )
    expect(
      (
        await api(
          owner,
          'post',
          `/organizations/${scope.organization.id}/invitations/${invitation.id}/resend`,
        )
      ).status,
    ).toBe(429)
    f.advance(61000)
    expect(
      (
        await api(
          owner,
          'post',
          `/organizations/${scope.organization.id}/invitations/${invitation.id}/resend`,
        )
      ).status,
    ).toBe(200)
    await f.tenants!.drainMail()
    const replacement = f.token('invitation')
    expect(replacement).not.toBe(invitation.token)
    expect(
      (await api(member, 'post', '/invitations/accept', { token: invitation.token })).status,
    ).toBe(410)
    expect(
      (
        await api(
          owner,
          'post',
          `/organizations/${scope.organization.id}/invitations/${invitation.id}/revoke`,
        )
      ).status,
    ).toBe(200)
    expect((await api(member, 'post', '/invitations/accept', { token: replacement })).status).toBe(
      410,
    )
    const expired = await invite(
      owner,
      scope.organization.id,
      scope.workspace.id,
      'member@example.com',
    )
    f.advance(73 * 3600000)
    expect(
      (await api(browser(f.app()), 'post', '/invitations/preview', { token: expired.token }))
        .status,
    ).toBe(410)
  })
  it.each(['VIEWER', 'MEMBER', 'MANAGER'])(
    '%s has read-only workspace access and cannot escalate',
    async (role) => {
      const owner = await verifiedBrowser(f),
        member = await person('member@example.com'),
        scope = await onboard(owner)
      const invitation = await invite(
        owner,
        scope.organization.id,
        scope.workspace.id,
        'member@example.com',
        role,
      )
      await api(member, 'post', '/invitations/accept', { token: invitation.token })
      expect((await api(member, 'get', `/workspaces/${scope.workspace.id}/members`)).status).toBe(
        200,
      )
      expect(
        (
          await api(member, 'patch', `/workspaces/${scope.workspace.id}`, {
            name: 'Escalation',
            version: 1,
          })
        ).status,
      ).toBe(403)
      expect(
        (
          await api(member, 'post', `/organizations/${scope.organization.id}/workspaces`, {
            name: 'Private',
            slug: 'private',
            creationKey: randomUUID(),
          })
        ).status,
      ).toBe(403)
      expect(
        (
          await api(member, 'post', `/organizations/${scope.organization.id}/invitations`, {
            email: 'evil@example.com',
            organizationRole: 'ADMIN',
            targets: [{ workspaceId: scope.workspace.id, role: 'ADMIN' }],
          })
        ).status,
      ).toBe(403)
    },
  )
  it('role changes and removals take effect with the existing access cookie; owners survive concurrent mutations', async () => {
    const owner = await verifiedBrowser(f),
      member = await person('member@example.com'),
      scope = await onboard(owner)
    const invitation = await invite(
      owner,
      scope.organization.id,
      scope.workspace.id,
      'member@example.com',
      'ADMIN',
    )
    await api(member, 'post', '/invitations/accept', { token: invitation.token })
    const members = (await api(owner, 'get', `/workspaces/${scope.workspace.id}/members`)).body.data
      .items as { id: string; role: string }[]
    const admin = members.find((m) => m.role === 'ADMIN')!,
      founding = members.find((m) => m.role === 'OWNER')!
    expect(
      (
        await api(member, 'patch', `/workspaces/${scope.workspace.id}/members/${admin.id}`, {
          role: 'ADMIN',
        })
      ).status,
    ).toBe(403)
    const protectedResults = await Promise.all([
      api(owner, 'delete', `/workspaces/${scope.workspace.id}/members/${founding.id}`),
      api(member, 'patch', `/workspaces/${scope.workspace.id}/members/${founding.id}`, {
        role: 'MEMBER',
      }),
    ])
    expect(protectedResults.map((r) => r.status)).toEqual([409, 409])
    expect(
      (
        await api(owner, 'patch', `/workspaces/${scope.workspace.id}/members/${admin.id}`, {
          role: 'VIEWER',
        })
      ).status,
    ).toBe(200)
    expect(
      (
        await api(member, 'patch', `/workspaces/${scope.workspace.id}`, {
          name: 'Denied',
          version: 1,
        })
      ).status,
    ).toBe(403)
    expect(
      (await api(owner, 'delete', `/workspaces/${scope.workspace.id}/members/${admin.id}`)).status,
    ).toBe(200)
    expect((await api(member, 'get', `/workspaces/${scope.workspace.id}`)).status).toBe(404)
    expect(
      await f.tenantModels!.WorkspaceMembership.countDocuments({
        workspaceId: scope.workspace.id,
        role: 'OWNER',
        status: 'active',
      }),
    ).toBe(1)
  })
  it('allows identical workspace slugs in different organizations; paginates and rejects stale settings', async () => {
    const owner = await verifiedBrowser(f),
      a = await onboard(owner),
      b = await onboard(owner, 'creative-agency')
    expect(a.workspace.id).not.toBe(b.workspace.id)
    const first = await api(owner, 'get', '/organizations?limit=1')
    expect(first.body.data.items).toHaveLength(1)
    expect(first.body.data.hasMore).toBe(true)
    const next = await api(
      owner,
      'get',
      `/organizations?limit=1&cursor=${String(first.body.data.nextCursor)}`,
    )
    expect(next.body.data.items).toHaveLength(1)
    expect(
      (await api(owner, 'patch', `/workspaces/${a.workspace.id}`, { name: 'Renamed', version: 1 }))
        .status,
    ).toBe(200)
    expect(
      (await api(owner, 'patch', `/workspaces/${a.workspace.id}`, { name: 'Stale', version: 1 }))
        .status,
    ).toBe(409)
    const csrf = await owner.agent
      .patch(`/api/v1/workspaces/${a.workspace.id}`)
      .send({ name: 'Bad CSRF', version: 2 })
    expect(csrf.status).toBe(403)
  })
  it('rejects disabled users and revoked sessions and prevents invitation IDOR', async () => {
    const owner = await verifiedBrowser(f),
      outsider = await person('outside@example.com'),
      scope = await onboard(owner)
    const invitation = await invite(
      owner,
      scope.organization.id,
      scope.workspace.id,
      'outside@example.com',
    )
    expect(
      (
        await api(
          outsider,
          'post',
          `/organizations/${scope.organization.id}/invitations/${invitation.id}/revoke`,
        )
      ).status,
    ).toBe(404)
    expect(
      (
        await api(
          owner,
          'delete',
          `/workspaces/${scope.workspace.id}/members/${new Types.ObjectId()}`,
        )
      ).status,
    ).toBe(404)
    await f.models.User.updateOne(
      { normalizedEmail: testIdentity.email },
      { $set: { accountStatus: 'disabled' } },
    )
    expect((await api(owner, 'get', '/organizations')).status).toBe(401)
    await outsider.post('logout-all')
    expect((await api(outsider, 'get', '/organizations')).status).toBe(401)
  })
  it('rolls onboarding back if founding membership persistence fails', async () => {
    const owner = await verifiedBrowser(f)
    const original = f.tenantModels!.WorkspaceMembership.create
    f.tenantModels!.WorkspaceMembership.create = (() => {
      throw new Error('Controlled persistence failure')
    }) as typeof original
    try {
      expect((await api(owner, 'post', '/organizations', company())).status).toBe(500)
    } finally {
      f.tenantModels!.WorkspaceMembership.create = original
    }
    expect(await f.tenantModels!.Organization.countDocuments()).toBe(0)
    expect(await f.tenantModels!.Workspace.countDocuments()).toBe(0)
    expect(await f.tenantModels!.OrganizationMembership.countDocuments()).toBe(0)
  })
  it('new users can register and verify after issuance; unverified users cannot accept', async () => {
    const owner = await verifiedBrowser(f),
      scope = await onboard(owner)
    const invitation = await invite(
      owner,
      scope.organization.id,
      scope.workspace.id,
      'new-person@example.com',
    )
    const member = browser(f.app())
    await member.post('register', { ...testIdentity, email: 'new-person@example.com' })
    expect(
      (
        await member.post('login', {
          email: 'new-person@example.com',
          password: testIdentity.password,
        })
      ).status,
    ).toBe(403)
    expect(
      (await api(member, 'post', '/invitations/accept', { token: invitation.token })).status,
    ).toBe(401)
    await member.post('verify-email', { token: f.token('verify-email') })
    await member.post('login', { email: 'new-person@example.com', password: testIdentity.password })
    expect(
      (await api(member, 'post', '/invitations/accept', { token: invitation.token })).status,
    ).toBe(200)
  })
  it('rejects duplicate pending invitations and forged owner roles without granting membership', async () => {
    const owner = await verifiedBrowser(f),
      scope = await onboard(owner)
    await invite(owner, scope.organization.id, scope.workspace.id, 'member@example.com')
    expect(
      (
        await api(owner, 'post', '/organizations/' + scope.organization.id + '/invitations', {
          email: 'member@example.com',
          organizationRole: 'MEMBER',
          targets: [{ workspaceId: scope.workspace.id, role: 'MEMBER' }],
        })
      ).status,
    ).toBe(409)
    expect(
      (
        await api(owner, 'post', '/organizations/' + scope.organization.id + '/invitations', {
          email: 'owner@example.com',
          organizationRole: 'OWNER',
          targets: [{ workspaceId: scope.workspace.id, role: 'OWNER' }],
        })
      ).status,
    ).toBe(422)
    expect(await f.tenantModels!.OrganizationMembership.countDocuments()).toBe(1)
  })
  it('revalidates the inviter role during acceptance and scopes workspace-admin authority', async () => {
    const owner = await verifiedBrowser(f),
      admin = await person('admin@example.com'),
      recipient = await person('recipient@example.com'),
      scope = await onboard(owner)
    const initial = await invite(
      owner,
      scope.organization.id,
      scope.workspace.id,
      'admin@example.com',
      'ADMIN',
    )
    await api(admin, 'post', '/invitations/accept', { token: initial.token })
    const allowed = await invite(
      admin,
      scope.organization.id,
      scope.workspace.id,
      'recipient@example.com',
    )
    const adminRow = await f.tenantModels!.WorkspaceMembership.findOne({
      workspaceId: scope.workspace.id,
      role: 'ADMIN',
    })
    await api(
      owner,
      'patch',
      '/workspaces/' + scope.workspace.id + '/members/' + String(adminRow!._id),
      { role: 'MEMBER' },
    )
    expect(
      (await api(recipient, 'post', '/invitations/accept', { token: allowed.token })).status,
    ).toBe(403)
    expect((await api(recipient, 'get', '/workspaces/' + scope.workspace.id)).status).toBe(404)
    const other = await api(
      owner,
      'post',
      '/organizations/' + scope.organization.id + '/workspaces',
      { name: 'Private workspace', slug: 'private', creationKey: randomUUID() },
    )
    expect((await api(admin, 'get', '/workspaces/' + String(other.body.data.id))).status).toBe(404)
  })
  it('organization admins inherit workspace access but cannot elevate themselves or other admins', async () => {
    const owner = await verifiedBrowser(f),
      admin = await person('admin@example.com'),
      scope = await onboard(owner)
    const issued = await api(
      owner,
      'post',
      '/organizations/' + scope.organization.id + '/invitations',
      {
        email: 'admin@example.com',
        organizationRole: 'ADMIN',
        targets: [{ workspaceId: scope.workspace.id, role: 'VIEWER' }],
      },
    )
    expect(issued.status).toBe(201)
    await f.tenants!.drainMail()
    await api(admin, 'post', '/invitations/accept', { token: f.token('invitation') })
    expect((await api(admin, 'get', '/workspaces/' + scope.workspace.id)).body.data.role).toBe(
      'ADMIN',
    )
    expect((await api(admin, 'get', '/me/workspaces')).body.data.items[0].role).toBe('ADMIN')
    const orgMember = await f.tenantModels!.OrganizationMembership.findOne({
      organizationId: scope.organization.id,
      role: 'ADMIN',
    })
    expect(
      (
        await api(
          admin,
          'patch',
          '/organizations/' + scope.organization.id + '/members/' + String(orgMember!._id),
          { role: 'ADMIN' },
        )
      ).status,
    ).toBe(403)
    expect(
      (
        await api(admin, 'post', '/organizations/' + scope.organization.id + '/invitations', {
          email: 'other@example.com',
          organizationRole: 'ADMIN',
          targets: [{ workspaceId: scope.workspace.id, role: 'MEMBER' }],
        })
      ).status,
    ).toBe(403)
    expect(
      (
        await api(admin, 'post', '/organizations/' + scope.organization.id + '/workspaces', {
          name: 'Admin workspace',
          slug: 'admin-space',
          creationKey: randomUUID(),
        })
      ).status,
    ).toBe(201)
    expect(
      (
        await api(
          owner,
          'delete',
          '/organizations/' + scope.organization.id + '/members/' + String(orgMember!._id),
        )
      ).status,
    ).toBe(409)
  })
  it('company removal revokes all child memberships but leaves other companies independent', async () => {
    const owner = await verifiedBrowser(f),
      member = await person('member@example.com'),
      a = await onboard(owner),
      b = await onboard(owner, 'creative-agency')
    for (const scope of [a, b]) {
      const inviteLink = await invite(
        owner,
        scope.organization.id,
        scope.workspace.id,
        'member@example.com',
      )
      await api(member, 'post', '/invitations/accept', { token: inviteLink.token })
    }
    const membership = await f.tenantModels!.OrganizationMembership.findOne({
      organizationId: a.organization.id,
      role: 'MEMBER',
    })
    expect(
      (
        await api(
          owner,
          'delete',
          '/organizations/' + a.organization.id + '/members/' + String(membership!._id),
        )
      ).status,
    ).toBe(200)
    expect((await api(member, 'get', '/workspaces/' + a.workspace.id)).status).toBe(404)
    expect((await api(member, 'get', '/workspaces/' + b.workspace.id)).status).toBe(200)
    expect(
      (await api(member, 'get', '/organizations')).body.data.items.map((o: { id: string }) => o.id),
    ).toEqual([b.organization.id])
  })
  it('archives conceal members, preserve owner restoration and keep owner listings reachable', async () => {
    const owner = await verifiedBrowser(f),
      member = await person('member@example.com'),
      scope = await onboard(owner)
    const invitation = await invite(
      owner,
      scope.organization.id,
      scope.workspace.id,
      'member@example.com',
    )
    await api(member, 'post', '/invitations/accept', { token: invitation.token })
    const org = (await api(owner, 'get', '/organizations/' + scope.organization.id)).body.data
    expect(
      (
        await api(owner, 'patch', '/organizations/' + scope.organization.id, {
          status: 'archived',
          version: org.version,
        })
      ).status,
    ).toBe(200)
    expect((await api(member, 'get', '/workspaces/' + scope.workspace.id)).status).toBe(404)
    expect((await api(owner, 'get', '/me/workspaces')).body.data.items).toHaveLength(1)
    const updated = (await api(owner, 'get', '/organizations/' + scope.organization.id)).body.data
    expect(
      (
        await api(owner, 'patch', '/organizations/' + scope.organization.id, {
          status: 'active',
          version: updated.version,
        })
      ).status,
    ).toBe(200)
    expect((await api(member, 'get', '/workspaces/' + scope.workspace.id)).status).toBe(200)
  })
  it('serializes tenant writes with single-session logout and rejects stale service contexts', async () => {
    const owner = await verifiedBrowser(f)
    const cookies = owner.login.headers['set-cookie'] as unknown as string[]
    const access = cookies
      .find((line) => line.startsWith('fw_access='))!
      .split(';')[0]!
      .slice('fw_access='.length)
    const actor = await f.service.authenticate(access)
    const results = await Promise.allSettled([
      f.tenants!.createOrganization(actor, {
        ...company(),
        description: '',
        website: '',
        industry: '',
      }),
      f.service.logout(access, undefined),
    ])
    expect(results[1]!.status).toBe('fulfilled')
    if (results[0]!.status === 'rejected')
      expect(results[0]!.reason).toMatchObject({ statusCode: 401 })
    await expect(
      f.tenants!.createOrganization(actor, {
        ...company('later-company'),
        description: '',
        website: '',
        industry: '',
      }),
    ).rejects.toMatchObject({ statusCode: 401 })
    expect(await f.tenantModels!.Organization.countDocuments()).toBe(
      results[0]!.status === 'fulfilled' ? 1 : 0,
    )
    expect(
      await f.tenantModels!.OrganizationMembership.countDocuments({
        role: 'OWNER',
        status: 'active',
      }),
    ).toBe(results[0]!.status === 'fulfilled' ? 1 : 0)
  })
})

describe('explicit permission matrices', () => {
  it.each(['OWNER', 'ADMIN'] as const)('%s can administer its scope', (role) => {
    expect(permissionMatrix[role]).toContain('workspace.create')
    expect(workspacePermissionMatrix[role]).toEqual([...workspacePermissions])
  })
  it.each(['MANAGER', 'MEMBER', 'VIEWER'] as const)(
    '%s cannot mutate workspace settings or team',
    (role) => {
      expect(workspacePermissionMatrix[role]).toEqual(['workspace.read', 'workspace.members.read'])
    },
  )
  it('organization MEMBER never inherits workspace administration', () => {
    expect(permissionMatrix.MEMBER).toEqual(['organization.read'])
  })
})
