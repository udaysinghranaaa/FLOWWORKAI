import { randomUUID } from 'node:crypto'
import type { RequestHandler } from 'express'

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export const requestId: RequestHandler = (req, res, next) => {
  const supplied = req.headers['x-request-id']
  // Duplicate, oversized, non-UUID and control-character values are replaced, never logged verbatim.
  const id =
    typeof supplied === 'string' && supplied.length === 36 && uuid.test(supplied)
      ? supplied.toLowerCase()
      : randomUUID()
  res.locals.requestId = id
  req.id = id
  res.setHeader('X-Request-ID', id)
  next()
}
