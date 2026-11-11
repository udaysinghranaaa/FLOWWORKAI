export interface ErrorDetail {
  path: string
  message: string
}
export type ErrorCode =
  | 'UNAUTHENTICATED'
  | 'INVALID_CREDENTIALS'
  | 'EMAIL_VERIFICATION_REQUIRED'
  | 'CSRF_INVALID'
  | 'ACTION_TOKEN_INVALID'
  | 'VALIDATION_FAILED'
  | 'MALFORMED_JSON'
  | 'MALFORMED_URL'
  | 'INVALID_REQUEST'
  | 'BODY_TOO_LARGE'
  | 'UNSUPPORTED_MEDIA_TYPE'
  | 'CORS_ORIGIN_DENIED'
  | 'NOT_FOUND'
  | 'RATE_LIMITED'
  | 'SERVICE_UNAVAILABLE'
  | 'INTERNAL_ERROR'

/** Only authored public messages belong here; never pass an upstream exception message. */
export class ApiError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: ErrorCode,
    message: string,
    public readonly details: readonly ErrorDetail[] = [],
  ) {
    super(message)
    if (!Number.isInteger(statusCode) || statusCode < 400 || statusCode > 599)
      throw new RangeError('API error status must be 400–599.')
    this.name = 'ApiError'
  }
}
