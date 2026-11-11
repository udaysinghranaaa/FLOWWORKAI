import { Router } from 'express'
import { rateLimit } from 'express-rate-limit'
import type { AuthConfig } from '../../config/auth-env.js'
import type { AuthService } from './auth.service.js'
import { ApiError } from '../../lib/api-error.js'
import { cookiePolicy } from './auth.cookies.js'
import { createCsrf } from '../../middleware/csrf.js'
import { requireAuth } from '../../middleware/require-auth.js'
import { validateRequest } from '../../middleware/validate-request.js'
import { routeContext } from '../../middleware/route-context.js'
import { createAuthController } from './auth.controller.js'
import {
  registerSchema,
  loginSchema,
  emailSchema,
  verifySchema,
  resetSchema,
  emptySchema,
  readSchema,
} from './auth.schema.js'

export interface AuthRuntime {
  service: AuthService
  config: AuthConfig
  isReady: () => boolean
  rateLimitMax?: number
}
export function createAuthRouter(runtime: AuthRuntime, origins: readonly string[]) {
  const router = Router({ caseSensitive: true, strict: true })
  const cookies = cookiePolicy(runtime.config),
    csrf = createCsrf(runtime.config, cookies, origins)
  const controller = createAuthController(runtime.service, runtime.config, cookies, csrf)
  const authenticated = requireAuth(runtime.service, cookies)
  const limit = rateLimit({
    windowMs: 15 * 60000,
    limit: runtime.rateLimitMax ?? 20,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    validate: { xForwardedForHeader: false, forwardedHeader: false },
    handler: (_req, _res, next) =>
      next(new ApiError(429, 'RATE_LIMITED', 'Please wait before trying again.')),
  })
  router.use(csrf.protect)
  router.get(
    '/csrf',
    routeContext('/api/v1/auth/csrf'),
    validateRequest(readSchema),
    controller.bootstrap,
  )
  router.get(
    '/me',
    routeContext('/api/v1/auth/me'),
    validateRequest(readSchema),
    authenticated,
    controller.me,
  )
  router.post(
    '/register',
    routeContext('/api/v1/auth/register'),
    limit,
    validateRequest(registerSchema),
    controller.register,
  )
  router.post(
    '/login',
    routeContext('/api/v1/auth/login'),
    limit,
    validateRequest(loginSchema),
    controller.login,
  )
  router.post(
    '/refresh',
    routeContext('/api/v1/auth/refresh'),
    validateRequest(emptySchema),
    controller.refresh,
  )
  router.post(
    '/logout',
    routeContext('/api/v1/auth/logout'),
    validateRequest(emptySchema),
    controller.logout,
  )
  router.post(
    '/logout-all',
    routeContext('/api/v1/auth/logout-all'),
    validateRequest(emptySchema),
    authenticated,
    controller.logoutAll,
  )
  router.post(
    '/forgot-password',
    routeContext('/api/v1/auth/forgot-password'),
    limit,
    validateRequest(emailSchema),
    controller.forgot,
  )
  router.post(
    '/reset-password',
    routeContext('/api/v1/auth/reset-password'),
    limit,
    validateRequest(resetSchema),
    controller.reset,
  )
  router.post(
    '/verify-email',
    routeContext('/api/v1/auth/verify-email'),
    limit,
    validateRequest(verifySchema),
    controller.verify,
  )
  router.post(
    '/resend-verification',
    routeContext('/api/v1/auth/resend-verification'),
    limit,
    validateRequest(emailSchema),
    controller.resend,
  )
  return router
}
