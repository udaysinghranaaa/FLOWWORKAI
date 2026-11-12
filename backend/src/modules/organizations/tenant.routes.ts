import { Router, type RequestHandler } from 'express'
import { z } from 'zod'
import { rateLimit } from 'express-rate-limit'
import type { AuthRuntime } from '../auth/auth.routes.js'
import type { AuthContext } from '../auth/auth.service.js'
import type { TenantService } from './tenant.service.js'
import type { Permission } from '../memberships/permissions.js'
import { cookiePolicy } from '../auth/auth.cookies.js'
import { createCsrf } from '../../middleware/csrf.js'
import { requireAuth } from '../../middleware/require-auth.js'
import { requireTenant } from '../../middleware/tenant-context.js'
import { validateRequest } from '../../middleware/validate-request.js'
import { routeContext } from '../../middleware/route-context.js'
import { tenantController, type TenantInput } from './tenant.controller.js'
import { ApiError } from '../../lib/api-error.js'
import * as schemas from './tenant.schema.js'

export function createTenantRouter(
  runtime: AuthRuntime,
  service: TenantService,
  origins: readonly string[],
) {
  const router = Router({ caseSensitive: true, strict: true }),
    cookies = cookiePolicy(runtime.config)
  const csrf = createCsrf(runtime.config, cookies, origins)
  const invitationLimit = rateLimit({
    windowMs: 3600000,
    limit: 20,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    validate: { xForwardedForHeader: false, forwardedHeader: false },
    handler: (_req, _res, next) =>
      next(new ApiError(429, 'RATE_LIMITED', 'Invitation rate limit reached.')),
  })
  const org = { orgId: schemas.idSchema },
    workspace = { workspaceId: schemas.idSchema }
  function endpoint<B extends z.ZodType>(
    method: 'get' | 'post' | 'patch' | 'delete',
    path: string,
    body: B,
    params: Record<string, z.ZodType>,
    operation: (actor: AuthContext, input: TenantInput<z.output<B>>) => Promise<unknown>,
    options: {
      list?: boolean
      status?: number
      scope?: 'organization' | 'workspace'
      permission?: Permission
      limited?: boolean
    } = {},
  ) {
    const schema = z.strictObject({
      body,
      params: z.strictObject(params),
      query: options.list ? schemas.pageSchema : z.strictObject({}),
    })
    const middleware: RequestHandler[] = [routeContext(`/api/v1${path}`), validateRequest(schema)]
    if (options.limited) middleware.push(invitationLimit)
    if (options.scope && options.permission)
      middleware.push(requireTenant(service, options.scope, options.permission))
    router[method](path, ...middleware, tenantController<B>(operation, options.status ?? 200))
  }
  const tenantPaths = ['/organizations', '/workspaces', '/me/workspaces', '/invitations']
  router.use(tenantPaths, csrf.protect)
  endpoint(
    'post',
    '/invitations/preview',
    schemas.invitationTokenBody,
    {},
    (_actor, input) => service.preview(input.body.token),
    { limited: true },
  )
  router.use(tenantPaths, requireAuth(runtime.service, cookies))
  endpoint(
    'post',
    '/organizations',
    schemas.createOrganizationBody,
    {},
    (actor, input) => service.createOrganization(actor, input.body),
    { status: 201 },
  )
  endpoint(
    'get',
    '/organizations',
    z.undefined(),
    {},
    (actor, input) => service.organizations(actor, input.query),
    { list: true },
  )
  endpoint(
    'get',
    '/me/workspaces',
    z.undefined(),
    {},
    (actor, input) => service.workspaces(actor, input.query),
    { list: true },
  )
  endpoint(
    'get',
    '/organizations/:orgId',
    z.undefined(),
    org,
    (actor, input) => service.organization(actor, input.params.orgId!),
    { scope: 'organization', permission: 'organization.read' },
  )
  endpoint(
    'patch',
    '/organizations/:orgId',
    schemas.updateOrganizationBody,
    org,
    (actor, input) => service.updateOrganization(actor, input.params.orgId!, input.body),
    { scope: 'organization', permission: 'organization.update' },
  )
  endpoint(
    'get',
    '/organizations/:orgId/workspaces',
    z.undefined(),
    org,
    (actor, input) => service.workspaces(actor, input.query, input.params.orgId!),
    { list: true, scope: 'organization', permission: 'organization.read' },
  )
  endpoint(
    'post',
    '/organizations/:orgId/workspaces',
    schemas.createWorkspaceBody,
    org,
    (actor, input) => service.createWorkspace(actor, input.params.orgId!, input.body),
    { status: 201, scope: 'organization', permission: 'workspace.create' },
  )
  endpoint(
    'get',
    '/workspaces/:workspaceId',
    z.undefined(),
    workspace,
    (actor, input) => service.overview(actor, input.params.workspaceId!),
    { scope: 'workspace', permission: 'workspace.read' },
  )
  endpoint(
    'patch',
    '/workspaces/:workspaceId',
    schemas.updateWorkspaceBody,
    workspace,
    (actor, input) => service.updateWorkspace(actor, input.params.workspaceId!, input.body),
    { scope: 'workspace', permission: 'workspace.update' },
  )
  endpoint(
    'get',
    '/organizations/:orgId/members',
    z.undefined(),
    org,
    (actor, input) => service.members(actor, input.params.orgId!, undefined, input.query),
    { list: true, scope: 'organization', permission: 'organization.members.read' },
  )
  endpoint(
    'get',
    '/workspaces/:workspaceId/members',
    z.undefined(),
    workspace,
    async (actor, input) => {
      const context = await service.workspaceContext(actor, input.params.workspaceId!)
      return service.members(
        actor,
        String(context.organization._id),
        input.params.workspaceId!,
        input.query,
      )
    },
    { list: true, scope: 'workspace', permission: 'workspace.members.read' },
  )
  for (const method of ['patch', 'delete'] as const) {
    endpoint(
      method,
      '/organizations/:orgId/members/:memberId',
      method === 'patch' ? schemas.organizationRoleBody : z.undefined(),
      { ...org, memberId: schemas.idSchema },
      (actor, input) =>
        service.mutateMember(
          actor,
          input.params.orgId!,
          undefined,
          input.params.memberId!,
          input.body?.role,
        ),
      { scope: 'organization', permission: 'organization.members.manage' },
    )
    endpoint(
      method,
      '/workspaces/:workspaceId/members/:memberId',
      method === 'patch' ? schemas.workspaceRoleBody : z.undefined(),
      { ...workspace, memberId: schemas.idSchema },
      async (actor, input) => {
        const context = await service.workspaceContext(actor, input.params.workspaceId!)
        return service.mutateMember(
          actor,
          String(context.organization._id),
          input.params.workspaceId!,
          input.params.memberId!,
          input.body?.role,
        )
      },
      { scope: 'workspace', permission: 'workspace.members.manage' },
    )
  }
  endpoint(
    'post',
    '/organizations/:orgId/invitations',
    schemas.inviteBody,
    org,
    (actor, input) => service.invite(actor, input.params.orgId!, input.body),
    { limited: true, status: 201 },
  )
  endpoint(
    'get',
    '/organizations/:orgId/invitations',
    z.undefined(),
    org,
    (actor, input) => service.invitations(actor, input.params.orgId!, input.query),
    { list: true, scope: 'organization', permission: 'organization.invitations.manage' },
  )
  endpoint(
    'get',
    '/workspaces/:workspaceId/invitations',
    z.undefined(),
    workspace,
    async (actor, input) => {
      const context = await service.workspaceContext(actor, input.params.workspaceId!)
      return service.invitations(
        actor,
        String(context.organization._id),
        input.query,
        input.params.workspaceId!,
      )
    },
    { list: true, scope: 'workspace', permission: 'workspace.invitations.manage' },
  )
  endpoint('post', '/invitations/accept', schemas.invitationTokenBody, {}, (actor, input) =>
    service.accept(actor, input.body.token),
  )
  for (const action of ['revoke', 'resend'] as const)
    endpoint(
      'post',
      `/organizations/:orgId/invitations/:invitationId/${action}`,
      z.strictObject({}).optional(),
      { ...org, invitationId: schemas.idSchema },
      (actor, input) =>
        service.manageInvitation(
          actor,
          input.params.orgId!,
          input.params.invitationId!,
          action === 'resend',
        ),
      { limited: true },
    )
  return router
}
