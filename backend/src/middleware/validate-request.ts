import type { RequestHandler } from 'express'
import type { z } from 'zod'
import { ApiError, type ErrorDetail } from '../lib/api-error.js'

export function validationDetails(error: z.ZodError): ErrorDetail[] {
  return error.issues.slice(0, 20).map((issue) => ({
    path: issue.path.map(String).join('.') || 'request',
    message: issue.code === 'unrecognized_keys' ? 'Unknown fields are not allowed.' : issue.message,
  }))
}

export function validateRequest<T extends z.ZodType>(schema: T): RequestHandler {
  return (req, res, next) => {
    const result = schema.safeParse({ body: req.body, params: req.params, query: req.query })
    if (!result.success) {
      next(
        new ApiError(
          422,
          'VALIDATION_FAILED',
          'Check the highlighted fields.',
          validationDetails(result.error),
        ),
      )
      return
    }
    // Express 5 exposes req.query as a getter. Keep parsed/coerced output separate from raw input.
    res.locals.validated = result.data
    next()
  }
}
