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
    const models = createAuthModels(database.connection)
    await ensureAuthIndexes(models)
    const service = await createAuthService({
      models,
      connection: database.connection,
      config: authConfig,
      mail,
      logger,
    })
    const app = createApp({
      config,
      logger,
      lifecycle,
      auth: { service, config: authConfig, isReady: database.isReady },
    })
    const running = await startHttpServer({
      app,
      config,
      logger,
      lifecycle,
      cleanupHooks: [
        async () => {
          await service.drainMail()
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
