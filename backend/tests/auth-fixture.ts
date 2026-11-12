import { createWorkModels, ensureWorkIndexes } from '../src/modules/work-management/work.models.js'
import { createWorkService } from '../src/modules/work-management/work.service.js'
import { randomBytes, randomUUID } from 'node:crypto'
import { MongoMemoryReplSet } from 'mongodb-memory-server'
import request from 'supertest'
import { parseAuthEnv } from '../src/config/auth-env.js'
import { connectDatabase } from '../src/lib/database.js'
import { createAuthModels, ensureAuthIndexes } from '../src/modules/auth/auth.models.js'
import { createAuthService } from '../src/modules/auth/auth.service.js'
import {
  createTenantModels,
  ensureTenantIndexes,
} from '../src/modules/organizations/tenant.models.js'
import { createTenantService } from '../src/modules/organizations/tenant.service.js'
import type { AuthMail } from '../src/lib/mail.js'
import { createApp } from '../src/app.js'
import { capturedLogger, testConfig } from './helpers.js'

import { assertSafeTestDatabase } from './test-database-safety.js'
export { assertSafeTestDatabase } from './test-database-safety.js'

/** Never reads process.env.MONGODB_URI or .env; only generated loopback replica sets. */
export async function createAuthFixture(options: { tenants?: boolean; work?: boolean } = {}) {
  const name = `flowwork_test_${randomUUID().replaceAll('-', '')}`
  const repl = await MongoMemoryReplSet.create({
    replSet: { count: 1 },
    instanceOpts: [{ launchTimeout: 60000 }],
  })
  const uri = repl.getUri(name)
  assertSafeTestDatabase(uri, 'test', name)
  const config = testConfig(),
    logging = capturedLogger()
  const database = await connectDatabase(uri, logging.logger)
  const models = createAuthModels(database.connection)
  await ensureAuthIndexes(models)
  const authConfig = parseAuthEnv(
    { MONGODB_URI: uri, JWT_SECRET: randomBytes(32).toString('hex') },
    config,
  )
  const messages: AuthMail[] = []
  let instant = Date.now()
  const now = () => new Date(instant)
  const service = await createAuthService({
    models,
    connection: database.connection,
    config: authConfig,
    mail: {
      send: async (message) => {
        messages.push(message)
      },
    },
    logger: logging.logger,
    now,
  })
  let available = true
  const tenantModels =
    options.tenants || options.work ? createTenantModels(database.connection) : undefined
  if (tenantModels) await ensureTenantIndexes(tenantModels)
  const tenants = tenantModels
    ? createTenantService({
        models: tenantModels,
        authModels: models,
        connection: database.connection,
        mail: {
          send: async (message) => {
            messages.push(message)
          },
        },
        logger: logging.logger,
        webOrigin: 'http://localhost:5173',
        now,
      })
    : undefined
  const workModels = options.work ? createWorkModels(database.connection) : undefined
  if (workModels) await ensureWorkIndexes(workModels)
  const work =
    workModels && tenants
      ? createWorkService({
          models: workModels,
          tenants,
          tenantModels: tenantModels!,
          authModels: models,
          now,
        })
      : undefined
  function app(max = 1000) {
    return createApp({
      config,
      logger: logging.logger,
      now,
      auth: {
        service,
        config: authConfig,
        isReady: () => available && database.isReady(),
        rateLimitMax: max,
        ...(tenants ? { tenants } : {}),
        ...(work ? { work } : {}),
      },
    })
  }
  return {
    app,
    config,
    authConfig,
    models,
    service,
    messages,
    logging,
    database,
    tenantModels,
    tenants,
    workModels,
    work,
    unavailable: (value: boolean) => {
      available = !value
    },
    advance: (ms: number) => {
      instant += ms
    },
    token: (purpose: AuthMail['purpose']) => {
      const message = messages.filter((item) => item.purpose === purpose).at(-1)
      if (!message) throw new Error('Expected captured mail')
      return new URLSearchParams(new URL(message.link).hash.slice(1)).get('token')!
    },
    reset: async () => {
      await service.drainMail()
      await tenants?.drainMail()
      assertSafeTestDatabase(uri, config.nodeEnv, database.connection.name)
      if (database.connection.host !== '127.0.0.1') throw new Error('Refusing non-loopback cleanup')
      if (workModels)
        for (const model of Object.values(workModels)) await model.collection.deleteMany({})
      await Promise.all([
        ...(tenantModels
          ? [
              tenantModels.Organization.deleteMany({}),
              tenantModels.Workspace.deleteMany({}),
              tenantModels.OrganizationMembership.deleteMany({}),
              tenantModels.WorkspaceMembership.deleteMany({}),
              tenantModels.Invitation.deleteMany({}),
            ]
          : []),
        models.User.deleteMany({}),
        models.Session.deleteMany({}),
        models.Verification.deleteMany({}),
        models.Reset.deleteMany({}),
      ])
      instant = Date.now()
      available = true
      messages.length = 0
      logging.lines.length = 0
    },
    close: async () => {
      await service.drainMail()
      await tenants?.drainMail()
      await database.close()
      await repl.stop()
    },
  }
}
export type AuthFixture = Awaited<ReturnType<typeof createAuthFixture>>
export const testIdentity = {
  name: 'Auth Test Person',
  email: 'auth-test@example.com',
  password: 'A unique test passphrase 947!',
}

export function browser(app: ReturnType<AuthFixture['app']>) {
  const agent = request.agent(app)
  async function csrf() {
    const response = await agent
      .get('/api/v1/auth/csrf')
      .set('Origin', 'http://localhost:5173')
      .expect(200)
    return String(response.body.data.csrfToken)
  }
  return {
    agent,
    csrf,
    post: async (path: string, body: object = {}) => {
      const token = await csrf()
      return agent
        .post(`/api/v1/auth/${path}`)
        .set('Origin', 'http://localhost:5173')
        .set('X-CSRF-Token', token)
        .send(body)
    },
  }
}

export async function verifiedBrowser(fixture: AuthFixture) {
  const client = browser(fixture.app())
  await client.post('register', testIdentity)
  await client.post('verify-email', { token: fixture.token('verify-email') })
  const login = await client.post('login', testIdentityForLogin())
  if (login.status !== 200) throw new Error('Fixture login did not succeed')
  return { ...client, login }
}
export const testIdentityForLogin = () => ({
  email: testIdentity.email,
  password: testIdentity.password,
})
