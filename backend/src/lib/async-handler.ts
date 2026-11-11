import type { RequestHandler } from 'express'

/** Express 5 already catches async rejections; this also supports promise-returning adapters explicitly. */
export function asyncHandler(handler: RequestHandler): RequestHandler {
  return (req, res, next) => {
    Promise.resolve()
      .then(() => handler(req, res, next))
      .catch(next)
  }
}
