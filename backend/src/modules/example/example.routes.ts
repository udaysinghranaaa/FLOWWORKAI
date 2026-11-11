import { Router, type RequestHandler } from 'express'
import { ApiError } from '../../lib/api-error.js'
import { routeContext } from '../../middleware/route-context.js'
import { validateRequest } from '../../middleware/validate-request.js'
import { createExampleController } from './example.controller.js'
import { listExampleSchema, detailExampleSchema, validateExampleSchema } from './example.schema.js'
import type { ExampleService } from './example.service.js'

const requireJson: RequestHandler = (req, _res, next) => {
  if (!req.is(['application/json', 'application/*+json'])) {
    next(new ApiError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Use Content-Type: application/json.'))
    return
  }
  next()
}

export function createExampleRouter(service: ExampleService) {
  const router = Router({ caseSensitive: true, strict: true })
  const controller = createExampleController(service)
  // Express 5 forwards rejected async controller promises to the central error handler.
  router.get(
    '/',
    routeContext('/api/v1/example'),
    validateRequest(listExampleSchema),
    controller.list,
  )
  router.get(
    '/:code',
    routeContext('/api/v1/example/:code'),
    validateRequest(detailExampleSchema),
    controller.detail,
  )
  router.post(
    '/validate',
    routeContext('/api/v1/example/validate'),
    requireJson,
    validateRequest(validateExampleSchema),
    controller.validate,
  )
  return router
}
