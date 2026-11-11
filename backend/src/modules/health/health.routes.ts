import { Router } from 'express'
import { createHealthController } from './health.controller.js'
import type { HealthService } from './health.service.js'
import { routeContext } from '../../middleware/route-context.js'

export function createHealthRouter(service: HealthService) {
  const router = Router({ caseSensitive: true, strict: true })
  const controller = createHealthController(service)
  router.get('/', routeContext('/api/v1/health'), controller.health)
  router.get('/live', routeContext('/api/v1/health/live'), controller.live)
  router.get('/ready', routeContext('/api/v1/health/ready'), controller.ready)
  return router
}
