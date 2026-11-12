import type { RequestHandler } from 'express'
import type { AuthContext } from '../modules/auth/auth.service.js'
import type { TenantService } from '../modules/organizations/tenant.service.js'
import type { Permission } from '../modules/memberships/permissions.js'
export function requireTenant(
  service: TenantService,
  scope: 'organization' | 'workspace',
  permission: Permission,
): RequestHandler {
  return async (_req, res, next) => {
    const input = res.locals.validated as { params: { orgId?: string; workspaceId?: string } }
    const actor = res.locals.principal as AuthContext
    res.locals.tenant =
      scope === 'workspace'
        ? await service.workspaceContext(actor, input.params.workspaceId!, permission)
        : await service.authorize(actor, input.params.orgId!, undefined, permission)
    next()
  }
}
