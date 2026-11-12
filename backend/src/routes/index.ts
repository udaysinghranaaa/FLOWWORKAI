import { createWorkRouter } from '../modules/work-management/work.routes.js'
import { Router } from 'express'
import type { AppConfig } from '../config/env.js'
import { createHealthRouter } from '../modules/health/health.routes.js'
import type { HealthService } from '../modules/health/health.service.js'
import { createExampleRouter } from '../modules/example/example.routes.js'
import type { ExampleService } from '../modules/example/example.service.js'
import { createAuthRouter, type AuthRuntime } from '../modules/auth/auth.routes.js'
import { createTenantRouter } from '../modules/organizations/tenant.routes.js'

export function createApiRouter(
  config: AppConfig,
  healthService: HealthService,
  exampleService: ExampleService,
  auth?: AuthRuntime,
) {
  const router = Router({ caseSensitive: true, strict: true })
  router.use('/health', createHealthRouter(healthService))
  if (auth) router.use('/auth', createAuthRouter(auth, config.frontendOrigins))
  if (auth?.work) router.use(createWorkRouter(auth, auth.work, config.frontendOrigins))
  if (auth?.tenants) router.use(createTenantRouter(auth, auth.tenants, config.frontendOrigins))
  if (config.nodeEnv !== 'production') router.use('/example', createExampleRouter(exampleService))
  return router
}
