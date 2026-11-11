import { createHmac, timingSafeEqual } from 'node:crypto'
import type { Request, Response, RequestHandler } from 'express'
import type { AuthConfig } from '../config/auth-env.js'
import type { CookiePolicy } from '../modules/auth/auth.cookies.js'
import { randomToken } from '../modules/auth/auth.crypto.js'
import { ApiError } from '../lib/api-error.js'

export function createCsrf(config: AuthConfig, cookies: CookiePolicy, origins: readonly string[]) {
  const key = createHmac('sha256', Buffer.from(config.jwtSecret, 'hex'))
    .update('flowwork-csrf-v1')
    .digest()
  const signature = (binding: string, value: string) =>
    createHmac('sha256', key).update(`${binding}\0${value}`).digest('base64url')
  function equal(a: string, b: string) {
    const first = Buffer.from(a),
      second = Buffer.from(b)
    return first.length === second.length && timingSafeEqual(first, second)
  }
  function binding(req: Request): string | undefined {
    const refresh = cookies.read(req, 'refresh')
    if (refresh && /^[a-f0-9]{24}\.[A-Za-z0-9_-]{43}$/.test(refresh))
      return `session:${refresh.slice(0, 24)}`
    const pre = cookies.read(req, 'pre')
    return pre && /^[A-Za-z0-9_-]{43}$/.test(pre) ? `pre:${pre}` : undefined
  }
  function valid(token: string, context: string) {
    if (!/^[A-Za-z0-9_-]{43}\.\d{13}\.[A-Za-z0-9_-]{43}$/.test(token)) return false
    const [nonce, timestamp, mac] = token.split('.')
    const age = Date.now() - Number(timestamp)
    return age >= 0 && age < 3600000 && equal(mac!, signature(context, `${nonce}.${timestamp}`))
  }
  function issue(res: Response, context: string) {
    const value = `${randomToken()}.${Date.now()}`
    const token = `${value}.${signature(context, value)}`
    cookies.set(res, 'csrf', token, 3600000)
    return token
  }
  function bootstrap(req: Request, res: Response) {
    let context = binding(req)
    if (!context) {
      const pre = randomToken()
      cookies.set(res, 'pre', pre, 3600000)
      context = `pre:${pre}`
    }
    const existing = cookies.read(req, 'csrf')
    return existing && valid(existing, context) ? existing : issue(res, context)
  }
  const protect: RequestHandler = (req, _res, next) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      next()
      return
    }
    const token = req.get('X-CSRF-Token'),
      cookie = cookies.read(req, 'csrf'),
      context = binding(req)
    if (
      !req.get('Origin') ||
      !origins.includes(req.get('Origin')!) ||
      req.get('Sec-Fetch-Site') === 'cross-site' ||
      !token ||
      !cookie ||
      !context ||
      !equal(token, cookie) ||
      !valid(token, context)
    ) {
      next(new ApiError(403, 'CSRF_INVALID', 'Reload the form and try again.'))
      return
    }
    next()
  }
  return {
    bootstrap,
    protect,
    forSession: (res: Response, sessionId: string) => issue(res, `session:${sessionId}`),
  }
}
