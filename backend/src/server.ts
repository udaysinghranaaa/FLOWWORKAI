import { assertIsolatedSchemaTarget } from './lib/test-schema-target.js'
import {
  createClientModels,
  ensureClientIndexes,
  clientIndexesReady,
} from './modules/clients/client.models.js'
import { createClientService } from './modules/clients/client.service.js'
import {
  createWorkModels,
  ensureWorkIndexes,
  workIndexesReady,
} from './modules/work-management/work.models.js'
import { createWorkService } from './modules/work-management/work.service.js'
import { parseEnv, ConfigurationError } from './config/env.js'
import { createLogger } from './lib/logger.js'
import { createApp } from './app.js'
import { startHttpServer, registerProcessHandlers } from './lib/server-lifecycle.js'
import type { LifecycleState } from './modules/health/health.service.js'
import { parseAuthEnv } from './config/auth-env.js'
import { connectDatabase, DatabaseConnectionError } from './lib/database.js'
import { createAuthModels, ensureAuthIndexes } from './modules/auth/auth.models.js'
import { createAuthService } from './modules/auth/auth.service.js'
import { createMailAdapter } from './lib/mail.js'
import { configureDns } from './config/dns.js'
import { createTenantModels, ensureTenantIndexes } from './modules/organizations/tenant.models.js'
import { tenantIndexesReady } from './modules/organizations/tenant.schema-initialization.js'
import { createTenantService } from './modules/organizations/tenant.service.js'

async function main(): Promise<void> {
  // npm start explicitly forces production even if a copied local .env says development.
  const env = process.argv.includes('--production')
    ? { ...process.env, NODE_ENV: 'production' }
    : process.env
  const config = parseEnv(env)
  configureDns(config.dnsServers)
  const logger = createLogger(config)
  const authConfig = parseAuthEnv(env, config)
  const mail = createMailAdapter(authConfig)
  const database = await connectDatabase(authConfig.mongoUri, logger)
  const lifecycle: LifecycleState = { ready: false, draining: false }
  try {
    if (config.nodeEnv === 'test') assertIsolatedSchemaTarget(database.connection)
    const models = createAuthModels(database.connection)
    await ensureAuthIndexes(models)
    const tenantModels = createTenantModels(database.connection)
    if (config.nodeEnv === 'test') await ensureTenantIndexes(tenantModels)
    else if (!(await tenantIndexesReady(tenantModels))) {
      logger.error(
        { code: 'TENANT_SCHEMA_NOT_READY' },
        'Rotate disclosed credentials privately, then explicitly initialize the Phase 5 schema before starting the application.',
      )
      throw new Error('Tenant schema is not initialized.')
    }
    const tenants = createTenantService({
      models: tenantModels,
      authModels: models,
      connection: database.connection,
      mail,
      logger,
      webOrigin: authConfig.webOrigin,
    })
    const workModels = createWorkModels(database.connection)
    if (config.nodeEnv === 'test') await ensureWorkIndexes(workModels)
    else if (!(await workIndexesReady(workModels))) {
      logger.error(
        { code: 'WORK_SCHEMA_NOT_READY' },
        'Phase 6 schema requires separately approved initialization.',
      )
      throw new Error('Work schema is not initialized.')
    }
    const work = createWorkService({
      models: workModels,
      tenants,
      tenantModels: tenantModels!,
      authModels: models,
    })
    const service = await createAuthService({
      models,
      connection: database.connection,
      config: authConfig,
      mail,
      logger,
    })
    const clientModels = createClientModels(database.connection)
    if (config.nodeEnv === 'test') await ensureClientIndexes(clientModels)
    else if (!(await clientIndexesReady(clientModels))) {
      logger.error(
        { code: 'CLIENT_SCHEMA_NOT_READY' },
        'Phase 7 schema requires separately approved initialization.',
      )
      throw new Error('Client schema is not initialized.')
    }
    const clients = createClientService({
      models: clientModels,
      tenants,
      tenantModels,
      work,
      workModels,
      authModels: models,
      mail,
      logger,
      webOrigin: authConfig.webOrigin,
    })
    const app = createApp({
      config,
      logger,
      lifecycle,
      // The loopback/generated-database guard above is mandatory before this test-only budget.
      ...(config.nodeEnv === 'test' ? { rateLimit: { limit: 2000 } } : {}),
      auth: { service, config: authConfig, isReady: database.isReady, tenants, work, clients },
    })
    const running = await startHttpServer({
      app,
      config,
      logger,
      lifecycle,
      cleanupHooks: [
        async () => {
          await service.drainMail()
          await tenants.drainMail()
          await clients.drainMail()
          mail.close?.()
        },
        database.close,
      ],
    })
    registerProcessHandlers(running, logger)
    running.server.on('error', (error) => {
      logger.fatal({ err: error }, 'HTTP listener failed')
      process.exitCode = 1
      void running.shutdown('listener-error').catch(() => process.exit(1))
    })
  } catch (error) {
    mail.close?.()
    await database.close().catch(() => {})
    logger.fatal(
      {
        err: error,
        code: error instanceof Error && 'code' in error ? String(error.code) : 'STARTUP_FAILED',
      },
      'HTTP server failed to start',
    )
    process.exitCode = 1
  }
}

void main().catch((error) => {
  const logger = createLogger({ nodeEnv: 'production', logLevel: 'error' })
  if (error instanceof ConfigurationError)
    logger.error(
      { fields: error.fields },
      'Invalid backend configuration; check .env.example. No values are shown.',
    )
  else if (error instanceof DatabaseConnectionError)
    logger.error({ code: error.code }, error.message)
  else logger.fatal({ err: error }, 'Backend startup failed')
  process.exitCode = 1
})
