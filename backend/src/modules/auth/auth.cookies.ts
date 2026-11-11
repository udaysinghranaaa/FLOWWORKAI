import { parseCookie } from 'cookie'
import type { Request, Response } from 'express'
import type { AuthConfig } from '../../config/auth-env.js'

export function cookiePolicy(config: AuthConfig) {
  const prefix = config.secureCookies ? '__Host-fw_' : 'fw_'
  const names = {
    access: `${prefix}access`,
    refresh: `${prefix}refresh`,
    csrf: `${prefix}csrf`,
    pre: `${prefix}pre`,
  }
  const options = {
    httpOnly: true,
    secure: config.secureCookies,
    sameSite: 'lax' as const,
    path: '/',
  }
  return {
    names,
    read: (req: Request, name: keyof typeof names): string | undefined => {
      const cookies = parseCookie(req.headers.cookie ?? '')
      const value = cookies[names[name]]
      return value && value.length <= 2048 ? value : undefined
    },
    set: (res: Response, name: keyof typeof names, value: string, maxAge: number) =>
      res.cookie(names[name], value, { ...options, maxAge }),
    clear: (res: Response) => {
      for (const name of Object.values(names)) res.clearCookie(name, options)
    },
  }
}
export type CookiePolicy = ReturnType<typeof cookiePolicy>
