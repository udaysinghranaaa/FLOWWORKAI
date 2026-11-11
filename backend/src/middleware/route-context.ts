import type { RequestHandler } from 'express'

/** Log route templates, not arbitrary paths, query strings, reset tokens or resource IDs. */
export function routeContext(template: string): RequestHandler {
  return (_req, res, next) => {
    res.locals.routeTemplate = template
    next()
  }
}
