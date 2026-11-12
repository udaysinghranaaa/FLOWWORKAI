import type { RequestHandler } from 'express'
import type { z } from 'zod'
import type { AuthContext } from '../auth/auth.service.js'
import { sendSuccess } from '../../utils/response.js'
import type { PageInput } from './tenant.schema.js'
export interface TenantInput<B> {
  body: B
  params: Record<string, string>
  query: PageInput
}
export function tenantController<B extends z.ZodType>(
  operation: (actor: AuthContext, input: TenantInput<z.output<B>>) => Promise<unknown>,
  status: number,
): RequestHandler {
  return async (_req, res) => {
    sendSuccess(
      res,
      await operation(
        res.locals.principal as AuthContext,
        res.locals.validated as TenantInput<z.output<B>>,
      ),
      status,
    )
  }
}
