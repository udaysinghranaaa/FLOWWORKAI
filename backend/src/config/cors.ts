import type { CorsOptions } from 'cors'
import { ApiError } from '../lib/api-error.js'
import type { AppConfig } from './env.js'

export function createCorsOptions(config: AppConfig, credentialed = false): CorsOptions {
  const origins = new Set(config.frontendOrigins)
  return {
    origin: (origin, callback) => {
      if (origin === undefined) {
        callback(null, false)
        return
      }
      if (origins.has(origin)) {
        callback(null, true)
        return
      }
      callback(new ApiError(403, 'CORS_ORIGIN_DENIED', 'This request origin is not allowed.'))
    },
    credentials: credentialed,
    methods: ['GET', 'HEAD', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Accept', 'X-Request-ID', 'X-CSRF-Token'],
    exposedHeaders: ['X-Request-ID', 'RateLimit', 'RateLimit-Policy', 'Retry-After'],
    maxAge: 600,
    optionsSuccessStatus: 204,
  }
}
