import { rateLimit } from 'express-rate-limit'
import { ApiError } from '../lib/api-error.js'

export interface RateLimitConfig {
  windowMs?: number
  limit?: number
}

/** Per-app process memory only. A shared store is required before multiple API replicas. */
export function createRateLimiter(options: RateLimitConfig = {}) {
  return rateLimit({
    windowMs: options.windowMs ?? 60_000,
    limit: options.limit ?? 120,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    ipv6Subnet: 56,
    // Proxy headers are deliberately ignored with trust proxy=false, not a configuration mistake.
    validate: { xForwardedForHeader: false, forwardedHeader: false },
    skip: (req) =>
      ['GET', 'HEAD'].includes(req.method) && /^\/health(?:\/live|\/ready)?$/.test(req.path),
    handler: (_req, res, next) => {
      res.locals.routeTemplate = '/api/v1/[rate-limited]'
      next(new ApiError(429, 'RATE_LIMITED', 'Too many requests. Retry after the indicated delay.'))
    },
  })
}
