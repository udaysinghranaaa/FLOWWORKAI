import type { RequestHandler } from 'express'
import type { HealthService } from './health.service.js'
import { sendSuccess } from '../../utils/response.js'

export function createHealthController(service: HealthService) {
  const health: RequestHandler = (_req, res) => {
    sendSuccess(res, service.health())
  }
  const live: RequestHandler = (_req, res) => {
    sendSuccess(res, service.live())
  }
  const ready: RequestHandler = (_req, res) => {
    sendSuccess(res, service.ready())
  }
  return { health, live, ready }
}
