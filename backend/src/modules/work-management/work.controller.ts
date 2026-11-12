import type { RequestHandler } from 'express'
import type { z } from 'zod'
import type { AuthContext } from '../auth/auth.service.js'
import { sendSuccess } from '../../utils/response.js'
export interface WorkInput<B, Q> {
  body: B
  params: Record<string, string>
  query: Q
}
export function workController<B extends z.ZodType, Q extends z.ZodType>(
  operation: (actor: AuthContext, input: WorkInput<z.output<B>, z.output<Q>>) => Promise<unknown>,
  status: number,
): RequestHandler {
  return async (_req, res) => {
    sendSuccess(
      res,
      await operation(
        res.locals.principal as AuthContext,
        res.locals.validated as WorkInput<z.output<B>, z.output<Q>>,
      ),
      status,
    )
  }
}
