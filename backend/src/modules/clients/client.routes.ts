import { Router } from 'express'
import { z } from 'zod'
import { rateLimit } from 'express-rate-limit'
import type { AuthRuntime } from '../auth/auth.routes.js'
import { cookiePolicy } from '../auth/auth.cookies.js'
import { createCsrf } from '../../middleware/csrf.js'
import { requireAuth } from '../../middleware/require-auth.js'
import { validateRequest } from '../../middleware/validate-request.js'
import { routeContext } from '../../middleware/route-context.js'
import { workController, type WorkInput } from '../work-management/work.controller.js'
import type { AuthContext } from '../auth/auth.service.js'
import { idSchema, invitationTokenBody } from '../organizations/tenant.schema.js'
import { ApiError } from '../../lib/api-error.js'
import type { ClientService } from './client.service.js'
import * as S from './client.schema.js'
export function createClientRouter(
  runtime: AuthRuntime,
  service: ClientService,
  origins: readonly string[],
) {
  const router = Router({ caseSensitive: true, strict: true }),
    cookies = cookiePolicy(runtime.config),
    none = z.undefined(),
    empty = z.strictObject({})
  router.use(
    ['/workspaces/:workspaceId/clients', '/portal'],
    createCsrf(runtime.config, cookies, origins).protect,
  )
  const limit = rateLimit({
    windowMs: 3600000,
    limit: runtime.rateLimitMax ?? 20,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_q, _r, next) =>
      next(new ApiError(429, 'RATE_LIMITED', 'Please wait before trying again.')),
  })
  router.post(
    '/portal/invitations/preview',
    limit,
    routeContext('/api/v1/portal/invitations/preview'),
    validateRequest(z.strictObject({ body: invitationTokenBody, query: empty, params: empty })),
    workController(async (_a, i) => service.preview((i.body as { token: string }).token), 200),
  )
  router.use(['/workspaces/:workspaceId/clients', '/portal'], requireAuth(runtime.service, cookies))
  function route<B extends z.ZodType, Q extends z.ZodType>(
    method: 'get' | 'post' | 'patch',
    path: string,
    body: B,
    query: Q,
    fn: (a: AuthContext, i: WorkInput<z.output<B>, z.output<Q>>) => Promise<unknown>,
    status = 200,
  ) {
    router[method](
      path,
      ...(path.includes('invitations') && method !== 'get' ? [limit] : []),
      routeContext('/api/v1' + path),
      validateRequest(
        z.strictObject({
          body,
          query,
          params: z.strictObject(
            Object.fromEntries([...path.matchAll(/:(\w+)/g)].map((m) => [m[1], idSchema])),
          ),
        }),
      ),
      workController<B, Q>(fn, status),
    )
  }
  const root = '/workspaces/:workspaceId/clients',
    c = root + '/:clientId',
    p = c + '/projects/:projectId'
  route('get', p, none, empty, (a, i) =>
    service.portalProject(a, i.params.clientId!, i.params.projectId!, i.params.workspaceId!),
  )
  route('get', root, none, S.query, (a, i) => service.clients(a, i.params.workspaceId!, i.query))
  route(
    'post',
    root,
    S.createClient,
    empty,
    (a, i) => service.createClient(a, i.params.workspaceId!, i.body),
    201,
  )
  route('get', c, none, empty, (a, i) =>
    service.getClient(a, i.params.workspaceId!, i.params.clientId!),
  )
  route('patch', c, S.updateClient, empty, (a, i) =>
    service.updateClient(a, i.params.workspaceId!, i.params.clientId!, i.body),
  )
  route('get', c + '/contacts', none, S.query, (a, i) =>
    service.contacts(a, i.params.workspaceId!, i.params.clientId!, i.query),
  )
  route(
    'post',
    c + '/contacts',
    S.createContact,
    empty,
    (a, i) => service.contact(a, i.params.workspaceId!, i.params.clientId!, i.body),
    201,
  )
  route('patch', c + '/contacts/:contactId', S.updateContact, empty, (a, i) =>
    service.contact(a, i.params.workspaceId!, i.params.clientId!, i.body, i.params.contactId!),
  )
  route('get', c + '/invitations', none, S.query, (a, i) =>
    service.invitations(a, i.params.workspaceId!, i.params.clientId!, i.query),
  )
  route(
    'post',
    c + '/invitations',
    S.invite,
    empty,
    (a, i) => service.invite(a, i.params.workspaceId!, i.params.clientId!, i.body),
    201,
  )
  for (const action of ['resend', 'revoke'])
    route('post', c + '/invitations/:invitationId/' + action, empty, empty, (a, i) =>
      service.changeInvitation(
        a,
        i.params.workspaceId!,
        i.params.clientId!,
        i.params.invitationId!,
        action === 'resend',
      ),
    )
  route('get', c + '/members', none, S.query, (a, i) =>
    service.memberships(a, i.params.clientId!, i.query, i.params.workspaceId!),
  )
  route('patch', c + '/members/:membershipId', S.membership, empty, (a, i) =>
    service.membership(
      a,
      i.params.clientId!,
      i.params.membershipId!,
      i.body,
      i.params.workspaceId!,
    ),
  )
  route('get', c + '/projects', none, S.query, (a, i) =>
    service.grants(a, i.params.workspaceId!, i.params.clientId!, i.query),
  )
  route(
    'post',
    c + '/projects',
    S.share,
    empty,
    (a, i) => service.share(a, i.params.workspaceId!, i.params.clientId!, i.body),
    201,
  )
  route('patch', p, S.updateGrant, empty, (a, i) =>
    service.updateGrant(a, i.params.workspaceId!, i.params.clientId!, i.params.projectId!, i.body),
  )
  route('get', c + '/activity', none, S.query, (a, i) =>
    service.activity(a, i.params.workspaceId!, i.params.clientId!, i.query),
  )
  route('post', '/portal/invitations/accept', invitationTokenBody, empty, (a, i) =>
    service.accept(a, i.body.token),
  )
  route('get', '/portal/clients', none, S.query, (a, i) => service.myPortals(a, i.query))
  const portal = '/portal/clients/:clientId',
    project = portal + '/projects/:projectId'
  route('get', portal, none, empty, (a, i) => service.dashboard(a, i.params.clientId!))
  route('get', portal + '/projects', none, S.query, (a, i) =>
    service.portalProjects(a, i.params.clientId!, i.query),
  )
  route('get', project, none, empty, (a, i) =>
    service.portalProject(a, i.params.clientId!, i.params.projectId!),
  )
  route('get', portal + '/members', none, S.query, (a, i) =>
    service.memberships(a, i.params.clientId!, i.query),
  )
  route('patch', portal + '/members/:membershipId', S.membership, empty, (a, i) =>
    service.membership(a, i.params.clientId!, i.params.membershipId!, i.body),
  )
  for (const [path, internal] of [
    [p, true],
    [project, false],
  ] as const) {
    route('get', path + '/resources/:resourceId', none, empty, (a, i) =>
      service.resource(
        a,
        i.params.clientId!,
        i.params.projectId!,
        i.params.resourceId!,
        internal ? i.params.workspaceId : undefined,
      ),
    )
    route('get', path + '/resources', none, S.query, (a, i) =>
      service.resources(
        a,
        i.params.clientId!,
        i.params.projectId!,
        i.query,
        internal ? i.params.workspaceId : undefined,
      ),
    )
    route(
      'post',
      path + '/resources',
      S.createResource,
      empty,
      (a, i) =>
        service.createResource(
          a,
          i.params.clientId!,
          i.params.projectId!,
          i.body,
          internal ? i.params.workspaceId : undefined,
        ),
      201,
    )
    route('patch', path + '/resources/:resourceId', S.updateResource, empty, (a, i) =>
      service.updateResource(
        a,
        i.params.clientId!,
        i.params.projectId!,
        i.params.resourceId!,
        i.body,
        internal ? i.params.workspaceId : undefined,
      ),
    )
  }
  return router
}
