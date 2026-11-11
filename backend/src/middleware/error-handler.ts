import type { ErrorRequestHandler } from 'express'
import { z } from 'zod'
import { ApiError } from '../lib/api-error.js'
import { safeDiagnostic } from '../lib/logger.js'
import { validationDetails } from './validate-request.js'
import type { ApiFailure } from '../types/http.js'

export function normalizeError(error: unknown): ApiError {
  if (error instanceof ApiError) return error
  if (error instanceof z.ZodError)
    return new ApiError(
      422,
      'VALIDATION_FAILED',
      'Check the highlighted fields.',
      validationDetails(error),
    )
  if (error instanceof URIError)
    return new ApiError(400, 'MALFORMED_URL', 'The request URL is malformed.')
  if (error instanceof Error && /^(Mongo|MongooseServerSelection)/.test(error.name))
    return new ApiError(503, 'SERVICE_UNAVAILABLE', 'A required dependency is unavailable.')
  const type =
    typeof error === 'object' && error !== null && 'type' in error ? error.type : undefined
  if (type === 'entity.parse.failed')
    return new ApiError(400, 'MALFORMED_JSON', 'The request body must contain valid JSON.')
  if (type === 'entity.too.large')
    return new ApiError(413, 'BODY_TOO_LARGE', 'The request body exceeds the 16 KiB limit.')
  if (type === 'encoding.unsupported' || type === 'charset.unsupported')
    return new ApiError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Use uncompressed UTF-8 JSON.')
  if (type === 'request.aborted' || type === 'request.size.invalid')
    return new ApiError(400, 'INVALID_REQUEST', 'The request could not be read.')
  return new ApiError(500, 'INTERNAL_ERROR', 'An unexpected error occurred.')
}

export const errorHandler: ErrorRequestHandler = (error: unknown, req, res, next) => {
  const normalized = normalizeError(error)
  res.locals.errorCode = normalized.code
  if (normalized.statusCode >= 500)
    req.log.error(
      {
        diagnostic: safeDiagnostic(error),
        errorCode: normalized.code,
        requestId: res.locals.requestId,
      },
      'Request processing failed',
    )
  if (res.headersSent) {
    next(normalized)
    return
  }
  const payload: ApiFailure = {
    error: { code: normalized.code, message: normalized.message, details: normalized.details },
    meta: { requestId: res.locals.requestId },
  }
  res.status(normalized.statusCode).json(payload)
}
