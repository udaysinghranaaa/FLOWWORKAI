import { beforeAll, afterAll, beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { SignJWT } from 'jose'
import { parseCookie } from 'cookie'
import { randomBytes } from 'node:crypto'
import {
  browser,
  createAuthFixture,
  testIdentity,
  testIdentityForLogin,
  verifiedBrowser,
  type AuthFixture,
} from '../auth-fixture.js'
import { tokenHash } from '../../src/modules/auth/auth.crypto.js'

let fixture: AuthFixture
beforeAll(async () => {
  fixture = await createAuthFixture()
}, 90000)
afterAll(async () => {
  await fixture?.close()
})
beforeEach(async () => {
  await fixture.reset()
})
function responseCookies(response: { headers: Record<string, unknown> }) {
  const lines = response.headers['set-cookie'] as string[]
  return lines.map((line) => line.split(';')[0]).join('; ')
}
function cookieValue(response: { headers: Record<string, unknown> }, key: string) {
  return parseCookie(responseCookies(response))[`fw_${key}`]!
}

describe('real database registration and schema boundaries', () => {
  it('persists one Argon2id identity with normalized unique email and no workspace', async () => {
    const client = browser(fixture.app())
    const result = await client.post('register', {
      ...testIdentity,
      email: '  AUTH-TEST@example.com  ',
    })
    expect(result.status).toBe(202)
    const user = await fixture.models.User.findOne().select('+passwordHash')
    expect(user?.normalizedEmail).toBe(testIdentity.email)
    expect(user?.passwordHash).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/)
    expect(user?.emailVerifiedAt).toBeNull()
    expect(JSON.stringify(result.body)).not.toMatch(
      /password|hashedToken|authVersion|accessToken|refreshToken/,
    )
    expect(
      (await fixture.database.connection.db!.listCollections().toArray()).some((item) =>
        /workspace|project|task/i.test(item.name),
      ),
    ).toBe(false)
  })
  it.each([
    { ...testIdentity, email: 'invalid' },
    { ...testIdentity, password: 'short' },
    { ...testIdentity, password: 'password1234' },
    { ...testIdentity, password: 'x'.repeat(129) },
    { ...testIdentity, name: 'x' },
    { ...testIdentity, role: 'Owner' },
  ])('rejects invalid or extra registration fields without saving', async (input) => {
    expect((await browser(fixture.app()).post('register', input)).status).toBe(422)
    expect(await fixture.models.User.countDocuments()).toBe(0)
  })
  it('handles simultaneous case-insensitive duplicate signups atomically and generically', async () => {
    const app = fixture.app(),
      a = browser(app),
      b = browser(app)
    const results = await Promise.all([
      a.post('register', testIdentity),
      b.post('register', { ...testIdentity, email: testIdentity.email.toUpperCase() }),
    ])
    expect(results.map((result) => result.status)).toEqual([202, 202])
    expect(results[0]!.body.data).toEqual(results[1]!.body.data)
    expect(await fixture.models.User.countDocuments()).toBe(1)
    expect(fixture.messages).toHaveLength(1)
    const indexes = await fixture.models.User.collection.indexes()
    expect(indexes.some((index) => index.key.normalizedEmail === 1 && index.unique)).toBe(true)
  })
  it('enforces model validation independently of HTTP schemas', async () => {
    const record = new fixture.models.User({
      name: 'x',
      email: 'broken',
      normalizedEmail: 'broken',
      passwordHash: 'plaintext',
    })
    await expect(record.validate()).rejects.toThrow()
  })
})

describe('login, access JWT and immediate session checks', () => {
  it('requires valid credentials and verified email', async () => {
    const client = browser(fixture.app())
    await client.post('register', testIdentity)
    expect((await client.post('login', testIdentityForLogin())).body.error.code).toBe(
      'EMAIL_VERIFICATION_REQUIRED',
    )
    const wrong = await client.post('login', {
      ...testIdentityForLogin(),
      password: 'wrong password',
    })
    const unknown = await client.post('login', {
      email: 'unknown@example.com',
      password: 'wrong password',
    })
    expect(wrong.status).toBe(401)
    expect(unknown.status).toBe(401)
    expect(wrong.body.error).toEqual(unknown.body.error)
  })
  it('returns only a safe verified identity and HttpOnly cookies', async () => {
    const client = await verifiedBrowser(fixture)
    expect(client.login.body.data.user).toEqual({
      id: expect.any(String),
      name: testIdentity.name,
      email: testIdentity.email,
      emailVerified: true,
      accountStatus: 'active',
      avatarUrl: null,
    })
    expect(JSON.stringify(client.login.body)).not.toMatch(
      /passwordHash|hashedRefresh|accessToken|refreshToken/,
    )
    const cookies = client.login.headers['set-cookie'] as unknown as string[]
    for (const value of cookies) {
      expect(value).toContain('HttpOnly')
      expect(value).toContain('SameSite=Lax')
      expect(value).toContain('Path=/')
    }
    expect((await client.agent.get('/api/v1/auth/me')).status).toBe(200)
    expect((await request(fixture.app()).get('/api/v1/auth/me')).status).toBe(401)
    expect(
      (await request(fixture.app()).get('/api/v1/auth/me').set('Authorization', 'Bearer demo'))
        .status,
    ).toBe(401)
  })
  it('checks current database account status instead of trusting JWT claims', async () => {
    const client = await verifiedBrowser(fixture)
    await fixture.models.User.updateOne({}, { $set: { accountStatus: 'disabled' } })
    expect((await client.agent.get('/api/v1/auth/me')).status).toBe(401)
    expect((await client.post('login', testIdentityForLogin())).body.error.code).toBe(
      'INVALID_CREDENTIALS',
    )
  })
  it.each(['expired', 'signature', 'issuer', 'audience', 'type', 'subject', 'session'])(
    'rejects %s JWT credentials',
    async (failure) => {
      const client = await verifiedBrowser(fixture)
      const row = await fixture.models.Session.findOne()
      const secret =
        failure === 'signature' ? randomBytes(32) : Buffer.from(fixture.authConfig.jwtSecret, 'hex')
      const token = await new SignJWT({
        sid: failure === 'session' ? '0'.repeat(24) : String(row!._id),
        sv: 0,
        tokenType: failure === 'type' ? 'refresh' : 'access',
      })
        .setProtectedHeader({ alg: 'HS256', typ: 'at+jwt' })
        .setIssuer(failure === 'issuer' ? 'other' : fixture.authConfig.issuer)
        .setAudience(failure === 'audience' ? 'other' : fixture.authConfig.audience)
        .setSubject(failure === 'subject' ? 'bad' : client.login.body.data.user.id)
        .setIssuedAt()
        .setExpirationTime(failure === 'expired' ? '-1s' : '10m')
        .sign(secret)
      expect(
        (await request(fixture.app()).get('/api/v1/auth/me').set('Cookie', `fw_access=${token}`))
          .status,
      ).toBe(401)
    },
  )
})

describe('atomic refresh rotation and family replay policy', () => {
  it('rotates hashes, retains consumed history and revokes on replay', async () => {
    const client = await verifiedBrowser(fixture),
      old = cookieValue(client.login, 'refresh')
    const next = await client.post('refresh')
    expect(next.status).toBe(200)
    const replacement = cookieValue(next, 'refresh')
    expect(replacement === old).toBe(false)
    const row = await fixture.models.Session.findOne().select(
      '+hashedRefreshToken +usedRefreshHashes',
    )
    expect(row?.hashedRefreshToken === tokenHash(replacement)).toBe(true)
    expect(row?.usedRefreshHashes.includes(tokenHash(old))).toBe(true)
    await expect(fixture.service.refresh(old)).rejects.toMatchObject({ statusCode: 401 })
    expect((await client.agent.get('/api/v1/auth/me')).status).toBe(401)
    expect((await fixture.models.Session.findOne())?.revokedAt).not.toBeNull()
  })
  it('fails closed on simultaneous rotation while committing the replay revocation', async () => {
    const client = await verifiedBrowser(fixture)
    const cookie = responseCookies(client.login),
      csrf = cookieValue(client.login, 'csrf'),
      app = fixture.app()
    const rotate = () =>
      request(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', cookie)
        .set('Origin', 'http://localhost:5173')
        .set('X-CSRF-Token', csrf)
        .send({})
    const results = await Promise.all([rotate(), rotate()])
    expect(results.map((result) => result.status).sort()).toEqual([200, 401])
    expect((await fixture.models.Session.findOne())?.revokedAt).not.toBeNull()
  })
  it('rejects unknown refresh material without letting a guessed session ID revoke a family', async () => {
    const client = await verifiedBrowser(fixture)
    const id = cookieValue(client.login, 'refresh').split('.')[0]
    await expect(
      fixture.service.refresh(`${id}.${randomBytes(32).toString('base64url')}`),
    ).rejects.toMatchObject({ statusCode: 401 })
    expect((await client.agent.get('/api/v1/auth/me')).status).toBe(200)
  })
  it('checks idle expiration immediately rather than depending on TTL cleanup', async () => {
    const client = await verifiedBrowser(fixture)
    fixture.advance(fixture.authConfig.idleMs + 1)
    await expect(
      fixture.service.refresh(cookieValue(client.login, 'refresh')),
    ).rejects.toMatchObject({ statusCode: 401 })
    expect((await client.agent.get('/api/v1/auth/me')).status).toBe(401)
    expect(await fixture.models.Session.countDocuments()).toBe(1)
  })
})

describe('logout, email actions and password reset', () => {
  it('logs out idempotently and immediately rejects an already-issued JWT and refresh', async () => {
    const client = await verifiedBrowser(fixture),
      access = cookieValue(client.login, 'access'),
      refresh = cookieValue(client.login, 'refresh')
    expect((await client.post('logout')).status).toBe(204)
    expect((await client.post('logout')).status).toBe(204)
    expect(
      (await request(fixture.app()).get('/api/v1/auth/me').set('Cookie', `fw_access=${access}`))
        .status,
    ).toBe(401)
    await expect(fixture.service.refresh(refresh)).rejects.toMatchObject({ statusCode: 401 })
  })
  it('logout-all revokes every session, including credentials from another device', async () => {
    const client = await verifiedBrowser(fixture),
      second = browser(fixture.app())
    await second.post('login', testIdentityForLogin())
    expect(await fixture.models.Session.countDocuments()).toBe(2)
    expect((await client.post('logout-all')).status).toBe(204)
    expect((await second.agent.get('/api/v1/auth/me')).status).toBe(401)
    expect(await fixture.models.Session.countDocuments({ revokedAt: null })).toBe(0)
  })
  it('consumes verification exactly once and keeps raw action tokens out of MongoDB', async () => {
    const client = browser(fixture.app())
    await client.post('register', testIdentity)
    const token = fixture.token('verify-email')
    const row = await fixture.models.Verification.findOne().select('+hashedToken')
    expect(row?.hashedToken === tokenHash(token)).toBe(true)
    expect((await client.post('verify-email', { token })).status).toBe(200)
    expect((await client.post('verify-email', { token })).status).toBe(410)
    expect(
      (await client.post('verify-email', { token: randomBytes(32).toString('base64url') })).status,
    ).toBe(410)
  })
  it('expires verification and throttles resend without revealing eligibility', async () => {
    const client = browser(fixture.app())
    await client.post('register', testIdentity)
    const original = fixture.token('verify-email')
    const known = await client.post('resend-verification', { email: testIdentity.email })
    const unknown = await client.post('resend-verification', { email: 'unknown@example.com' })
    expect(known.body.data).toEqual(unknown.body.data)
    expect(fixture.messages).toHaveLength(1)
    fixture.advance(3600001)
    expect((await client.post('verify-email', { token: original })).status).toBe(410)
    await client.post('resend-verification', { email: testIdentity.email })
    expect(fixture.messages).toHaveLength(2)
    expect(
      (await client.post('verify-email', { token: fixture.token('verify-email') })).status,
    ).toBe(200)
  })
  it('returns generic recovery responses and resets once while revoking all sessions', async () => {
    const client = await verifiedBrowser(fixture)
    const known = await client.post('forgot-password', { email: testIdentity.email })
    const unknown = await client.post('forgot-password', { email: 'unknown@example.com' })
    expect(known.body.data).toEqual(unknown.body.data)
    const token = fixture.token('reset-password'),
      password = 'A changed passphrase 852!'
    expect((await client.post('reset-password', { token, password })).status).toBe(204)
    expect((await client.post('reset-password', { token, password })).status).toBe(410)
    expect((await client.agent.get('/api/v1/auth/me')).status).toBe(401)
    expect((await client.post('login', testIdentityForLogin())).status).toBe(401)
    expect((await client.post('login', { email: testIdentity.email, password })).status).toBe(200)
  })
  it('rejects expired reset links and consumes concurrent reset requests only once', async () => {
    const client = await verifiedBrowser(fixture)
    await client.post('forgot-password', { email: testIdentity.email })
    const expired = fixture.token('reset-password')
    fixture.advance(900001)
    expect(
      (
        await client.post('reset-password', {
          token: expired,
          password: 'Another safe passphrase 963!',
        })
      ).status,
    ).toBe(410)
    await client.post('forgot-password', { email: testIdentity.email })
    const token = fixture.token('reset-password')
    const results = await Promise.allSettled([
      fixture.service.resetPassword(token, 'First new passphrase 321!'),
      fixture.service.resetPassword(token, 'Second new passphrase 456!'),
    ])
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1)
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1)
  })
})

describe('cookie authentication security and dependency health', () => {
  it('rejects absent CSRF, forged CSRF, missing Origin and cross-site fetch metadata', async () => {
    const app = fixture.app(),
      client = browser(app)
    expect(
      (await request(app).post('/api/v1/auth/register').send(testIdentity)).body.error.code,
    ).toBe('CSRF_INVALID')
    await client.csrf()
    expect(
      (
        await client.agent
          .post('/api/v1/auth/login')
          .set('Origin', 'http://localhost:5173')
          .set('X-CSRF-Token', 'forged')
          .send(testIdentityForLogin())
      ).status,
    ).toBe(403)
    const csrf = await client.csrf()
    expect(
      (
        await client.agent
          .post('/api/v1/auth/login')
          .set('X-CSRF-Token', csrf)
          .send(testIdentityForLogin())
      ).status,
    ).toBe(403)
    expect(
      (
        await client.agent
          .post('/api/v1/auth/login')
          .set('Origin', 'http://localhost:5173')
          .set('Sec-Fetch-Site', 'cross-site')
          .set('X-CSRF-Token', csrf)
          .send(testIdentityForLogin())
      ).status,
    ).toBe(403)
  })
  it('enforces real auth throttling and credentialed exact-origin CORS', async () => {
    const app = fixture.app(2),
      client = browser(app)
    const preflight = await request(app)
      .options('/api/v1/auth/login')
      .set('Origin', 'http://localhost:5173')
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'X-CSRF-Token')
    expect(preflight.headers['access-control-allow-credentials']).toBe('true')
    expect(preflight.headers['access-control-allow-origin']).toBe('http://localhost:5173')
    await client.post('login', testIdentityForLogin())
    await client.post('login', testIdentityForLogin())
    const limited = await client.post('login', testIdentityForLogin())
    expect(limited.status).toBe(429)
    expect(limited.body.error.code).toBe('RATE_LIMITED')
    expect(limited.headers['retry-after']).toBeTruthy()
  })
  it('never logs credentials, email addresses, hashes or action links', async () => {
    const client = await verifiedBrowser(fixture)
    await client.post('forgot-password', { email: testIdentity.email })
    const logs = fixture.logging.lines.join('')
    expect(logs.includes(testIdentity.email)).toBe(false)
    expect(logs.includes(testIdentity.password)).toBe(false)
    expect(logs.includes(cookieValue(client.login, 'refresh'))).toBe(false)
    expect(logs.includes(fixture.token('reset-password'))).toBe(false)
    expect(logs.includes(fixture.authConfig.mongoUri)).toBe(false)
  })
  it('marks readiness unavailable on dependency failure without failing liveness', async () => {
    const app = fixture.app()
    expect((await request(app).get('/api/v1/health')).body.data.phase).toBe(4)
    fixture.unavailable(true)
    expect((await request(app).get('/api/v1/health/ready')).status).toBe(503)
    expect((await request(app).get('/api/v1/auth/me')).status).toBe(503)
    expect((await request(app).get('/api/v1/health/live')).status).toBe(200)
    fixture.unavailable(false)
    expect((await request(app).get('/api/v1/health/ready')).status).toBe(200)
  })
})
