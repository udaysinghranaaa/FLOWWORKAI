import type { RequestHandler } from 'express'
import type { z } from 'zod'
import type { AuthConfig } from '../../config/auth-env.js'
import type { AuthService, AuthContext } from './auth.service.js'
import type { CookiePolicy } from './auth.cookies.js'
import type { createCsrf } from '../../middleware/csrf.js'
import type {
  registerSchema,
  loginSchema,
  emailSchema,
  resetSchema,
  verifySchema,
} from './auth.schema.js'
import { sendSuccess } from '../../utils/response.js'

export function createAuthController(
  service: AuthService,
  config: AuthConfig,
  cookies: CookiePolicy,
  csrf: ReturnType<typeof createCsrf>,
) {
  const message = {
    message: 'If this address is eligible, follow the verification or recovery instructions.',
    deliveryMode: config.mailMode === 'capture' ? 'development-capture' : 'email-provider',
  }
  const register: RequestHandler = async (_req, res) => {
    await service.register((res.locals.validated as z.output<typeof registerSchema>).body)
    sendSuccess(res, { ...message, verificationRequired: true }, 202)
  }
  const login: RequestHandler = async (req, res) => {
    const result = await service.login(
      (res.locals.validated as z.output<typeof loginSchema>).body,
      req.get('User-Agent') ?? '',
    )
    credentials(res, result)
  }
  const refresh: RequestHandler = async (req, res) => {
    credentials(res, await service.refresh(cookies.read(req, 'refresh')))
  }
  function credentials(
    res: Parameters<RequestHandler>[1],
    result: Awaited<ReturnType<AuthService['login']>>,
  ) {
    cookies.set(res, 'access', result.accessToken, config.accessSeconds * 1000)
    cookies.set(res, 'refresh', result.refreshToken, Math.max(0, +result.expiresAt - Date.now()))
    const csrfToken = csrf.forSession(res, result.sessionId)
    sendSuccess(res, {
      user: result.user,
      sessionExpiresAt: result.expiresAt.toISOString(),
      csrfToken,
    })
  }
  const logout: RequestHandler = async (req, res) => {
    await service.logout(cookies.read(req, 'access'), cookies.read(req, 'refresh'))
    cookies.clear(res)
    res.status(204).end()
  }
  const logoutAll: RequestHandler = async (_req, res) => {
    await service.logoutAll(res.locals.principal as AuthContext)
    cookies.clear(res)
    res.status(204).end()
  }
  const me: RequestHandler = (_req, res) => {
    sendSuccess(res, { user: (res.locals.principal as AuthContext).user })
  }
  const forgot: RequestHandler = async (_req, res) => {
    await service.forgotPassword((res.locals.validated as z.output<typeof emailSchema>).body.email)
    sendSuccess(res, message, 202)
  }
  const resend: RequestHandler = async (_req, res) => {
    await service.resendVerification(
      (res.locals.validated as z.output<typeof emailSchema>).body.email,
    )
    sendSuccess(res, message, 202)
  }
  const verify: RequestHandler = async (_req, res) => {
    await service.verifyEmail((res.locals.validated as z.output<typeof verifySchema>).body.token)
    sendSuccess(res, { verified: true })
  }
  const reset: RequestHandler = async (_req, res) => {
    const body = (res.locals.validated as z.output<typeof resetSchema>).body
    await service.resetPassword(body.token, body.password)
    cookies.clear(res)
    res.status(204).end()
  }
  const bootstrap: RequestHandler = (req, res) => {
    sendSuccess(res, { csrfToken: csrf.bootstrap(req, res) })
  }
  return {
    register,
    login,
    refresh,
    logout,
    logoutAll,
    me,
    forgot,
    resend,
    verify,
    reset,
    bootstrap,
  }
}
