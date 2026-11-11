import type { RequestHandler } from 'express'
import { ApiError } from '../lib/api-error.js'
export const notFound: RequestHandler = (_req, _res, next) => {
  next(new ApiError(404, 'NOT_FOUND', 'Route not found.'))
}
