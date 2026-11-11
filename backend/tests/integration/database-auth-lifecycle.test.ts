import { beforeAll, beforeEach, afterAll, describe, expect, it } from 'vitest'
import { parseCookie } from 'cookie'
import { createApp } from '../../src/app.js'
import { connectDatabase } from '../../src/lib/database.js'
import { createAuthService } from '../../src/modules/auth/auth.service.js'
import {
  createAuthFixture,
  verifiedBrowser,
  browser,
  testIdentity,
  testIdentityForLogin,
  type AuthFixture,
} from '../auth-fixture.js'

let fixture: AuthFixture
beforeAll(async () => {
  fixture = await createAuthFixture()
}, 90000)
beforeEach(async () => {
  await fixture.reset()
})
afterAll(async () => {
  await fixture?.close()
})

describe('database lifecycle and cross-operation authentication boundaries', () => {
  it('tracks real connection readiness and closes without affecting another connection', async () => {
    const extra = await connectDatabase(fixture.authConfig.mongoUri, fixture.logging.logger)
    try {
      expect(extra.isReady()).toBe(true)
      expect(fixture.database.isReady()).toBe(true)
    } finally {
      await extra.close()
    }
    expect(extra.isReady()).toBe(false)
    expect(fixture.database.isReady()).toBe(true)
  })
  it('rejects malformed connection configuration with a sanitized category', async () => {
    await expect(
      connectDatabase('mongodb://[private-diagnostic-marker', fixture.logging.logger),
    ).rejects.toMatchObject({ code: 'DATABASE_URI_INVALID' })
    expect(fixture.logging.lines.join('').includes('private-diagnostic-marker')).toBe(false)
  })
  it('does not turn mail-provider failure into an account oracle or leak provider diagnostics', async () => {
    const service = await createAuthService({
      models: fixture.models,
      connection: fixture.database.connection,
      config: fixture.authConfig,
      logger: fixture.logging.logger,
      mail: {
        send: async () => {
          throw new Error('private-provider-diagnostic')
        },
      },
    })
    const app = createApp({
      config: fixture.config,
      logger: fixture.logging.logger,
      auth: { service, config: fixture.authConfig, isReady: fixture.database.isReady },
    })
    expect((await browser(app).post('register', testIdentity)).status).toBe(202)
    await service.drainMail()
    expect(await fixture.models.User.countDocuments()).toBe(1)
    const logs = fixture.logging.lines.join('')
    expect(logs).toContain('MAIL_DELIVERY_FAILED')
    expect(logs.includes('private-provider-diagnostic')).toBe(false)
    expect(logs.includes(testIdentity.email)).toBe(false)
  })
  it('serializes password reset with simultaneous old-password login and refresh', async () => {
    const client = await verifiedBrowser(fixture)
    await fixture.service.forgotPassword(testIdentity.email)
    const cookieHeader = (client.login.headers['set-cookie'] as unknown as string[])
      .map((value) => value.split(';')[0])
      .join('; ')
    const refresh = parseCookie(cookieHeader).fw_refresh!
    const results = await Promise.allSettled([
      fixture.service.resetPassword(
        fixture.token('reset-password'),
        'A concurrent changed passphrase 741!',
      ),
      fixture.service.login(testIdentityForLogin(), 'controlled-test-device'),
      fixture.service.refresh(refresh),
    ])
    expect(results[0]?.status).toBe('fulfilled')
    for (const result of results.slice(1)) {
      if (result.status === 'fulfilled' && result.value)
        await expect(fixture.service.authenticate(result.value.accessToken)).rejects.toMatchObject({
          statusCode: 401,
        })
    }
  })
})
