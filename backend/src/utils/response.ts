import type { Response } from 'express'
import type { ApiSuccess } from '../types/http.js'

export function sendSuccess<T>(res: Response, data: T, status = 200): void {
  const payload: ApiSuccess<T> = { data, meta: { requestId: res.locals.requestId } }
  res.status(status).json(payload)
}
