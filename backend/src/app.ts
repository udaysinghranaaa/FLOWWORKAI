import express from 'express'
import helmet from 'helmet'
import cors from 'cors'
import type { Logger } from 'pino'
import type { AppConfig } from './config/env.js'
import { createCorsOptions } from './config/cors.js'
import { createLogger, createHttpLogger } from './lib/logger.js'
import { ApiError } from './lib/api-error.js'
import { requestId } from './middleware/request-id.js'
import { createRateLimiter, type RateLimitConfig } from './middleware/rate-limit.js'
import { notFound } from './middleware/not-found.js'
import { errorHandler } from './middleware/error-handler.js'
import { createHealthService, type LifecycleState } from './modules/health/health.service.js'
import { createExampleService, type ExampleService } from './modules/example/example.service.js'
import { createApiRouter } from './routes/index.js'
import type { AuthRuntime } from './modules/auth/auth.routes.js'

export interface AppOptions {
  config: AppConfig
  logger?: Logger
  lifecycle?: LifecycleState
  exampleService?: ExampleService
  rateLimit?: RateLimitConfig
  now?: () => Date
  auth?: AuthRuntime
}

/** Each call exports an isolated Express app for Supertest. No listener or environment import side effect. */
export function createApp(options: AppOptions) {
  const { config } = options
  const logger = options.logger ?? createLogger(config)
  const lifecycle = options.lifecycle ?? { ready: true, draining: false }
  const app = express()
  app.disable('x-powered-by')
  app.disable('etag')
  app.set('env', config.nodeEnv)
  app.set('trust proxy', false)
  app.set('query parser', 'simple')
  app.set('case sensitive routing', true)
  app.set('strict routing', true)
  app.use(requestId)
  app.use(createHttpLogger(logger))
  app.use(
    helmet({
      strictTransportSecurity:
        config.nodeEnv === 'production' ? { maxAge: 31536000, includeSubDomains: true } : false,
    }),
  )
  app.use((_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store')
    res.vary('Origin')
    next()
  })
  app.use(cors(createCorsOptions(config, !!options.auth)))
  app.use('/api/v1', createRateLimiter(options.rateLimit))
  app.use((req, _res, next) => {
    if (lifecycle.draining && req.path !== '/api/v1/health/live') {
      next(new ApiError(503, 'SERVICE_UNAVAILABLE', 'The service is shutting down.'))
      return
    }
    if (options.auth && !options.auth.isReady() && req.path !== '/api/v1/health/live') {
      next(new ApiError(503, 'SERVICE_UNAVAILABLE', 'A required dependency is unavailable.'))
      return
    }
    next()
  })
  app.use(
    express.json({
      limit: '16kb',
      strict: true,
      inflate: false,
      type: ['application/json', 'application/*+json'],
    }),
  )
  app.use(
    '/api/v1',
    createApiRouter(
      config,
      createHealthService(
        lifecycle,
        options.now,
        options.auth?.isReady,
        options.auth?.tenants ? 5 : options.auth ? 4 : 3,
      ),
      options.exampleService ?? createExampleService(),
      options.auth,
    ),
  )
  app.use(notFound)
  app.use(errorHandler)
  return app
}
