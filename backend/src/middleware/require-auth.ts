import type { RequestHandler } from 'express'
import type { AuthService } from '../modules/auth/auth.service.js'
import type { CookiePolicy } from '../modules/auth/auth.cookies.js'

export function requireAuth(service: AuthService, cookies: CookiePolicy): RequestHandler {
  return async (req, res, next) => {
    res.locals.principal = await service.authenticate(cookies.read(req, 'access'))
    next()
  }
}
