import { Router } from 'express'
import { z } from 'zod'
import type { AuthRuntime } from '../auth/auth.routes.js'
import type { AuthContext } from '../auth/auth.service.js'
import type { WorkService } from './work.service.js'
import { workController, type WorkInput } from './work.controller.js'
import { workConfig } from './work.constants.js'
import { cookiePolicy } from '../auth/auth.cookies.js'
import { createCsrf } from '../../middleware/csrf.js'
import { requireAuth } from '../../middleware/require-auth.js'
import { validateRequest } from '../../middleware/validate-request.js'
import { routeContext } from '../../middleware/route-context.js'
import { idSchema } from '../organizations/tenant.schema.js'
import * as schema from './work.schema.js'
export function createWorkRouter(
  runtime: AuthRuntime,
  service: WorkService,
  origins: readonly string[],
) {
  const router = Router({ caseSensitive: true, strict: true }),
    cookies = cookiePolicy(runtime.config),
    empty = z.strictObject({}),
    none = z.undefined()
  router.use(
    [
      '/workspaces/:workspaceId/projects',
      '/workspaces/:workspaceId/tasks',
      '/workspaces/:workspaceId/dashboard',
      '/work-management',
    ],
    createCsrf(runtime.config, cookies, origins).protect,
    requireAuth(runtime.service, cookies),
  )
  function route<B extends z.ZodType, Q extends z.ZodType>(
    method: 'get' | 'post' | 'patch' | 'delete',
    path: string,
    body: B,
    query: Q,
    operation: (actor: AuthContext, input: WorkInput<z.output<B>, z.output<Q>>) => Promise<unknown>,
    status = 200,
  ) {
    const params = Object.fromEntries(
      [...path.matchAll(/:(\w+)/g)].map((match) => [match[1], idSchema]),
    )
    router[method](
      path,
      routeContext('/api/v1' + path),
      validateRequest(z.strictObject({ body, query, params: z.strictObject(params) })),
      workController<B, Q>(operation, status),
    )
  }
  route('get', '/work-management/config', none, empty, async () => workConfig)
  const root = '/workspaces/:workspaceId',
    projects = root + '/projects',
    project = projects + '/:projectId',
    tasks = project + '/tasks',
    task = tasks + '/:taskId'
  route('get', projects, none, schema.listQuery, (a, i) =>
    service.projects(a, i.params.workspaceId!, i.query),
  )
  route(
    'post',
    projects,
    schema.projectCreate,
    empty,
    (a, i) => service.createProject(a, i.params.workspaceId!, i.body),
    201,
  )
  route('get', project, none, empty, (a, i) =>
    service.project(a, i.params.workspaceId!, i.params.projectId!),
  )
  route('patch', project, schema.projectUpdate, empty, (a, i) =>
    service.updateProject(a, i.params.workspaceId!, i.params.projectId!, i.body),
  )
  route('get', project + '/members', none, schema.pageQuery, (a, i) =>
    service.members(a, i.params.workspaceId!, i.params.projectId!, i.query),
  )
  route('post', project + '/members', schema.memberBody, empty, (a, i) =>
    service.member(a, i.params.workspaceId!, i.params.projectId!, i.body),
  )
  route('delete', project + '/members/:userId', schema.versionBody, empty, (a, i) =>
    service.member(a, i.params.workspaceId!, i.params.projectId!, {
      ...i.body,
      userId: i.params.userId!,
    }),
  )
  route('get', root + '/tasks', none, schema.taskQuery, (a, i) =>
    service.tasks(a, i.params.workspaceId!, i.query),
  )
  route('get', tasks, none, schema.taskQuery, (a, i) =>
    service.tasks(a, i.params.workspaceId!, i.query, i.params.projectId!),
  )
  route(
    'post',
    tasks,
    schema.taskCreate,
    empty,
    (a, i) => service.createTask(a, i.params.workspaceId!, i.params.projectId!, i.body),
    201,
  )
  route('get', task, none, empty, (a, i) =>
    service.task(a, i.params.workspaceId!, i.params.projectId!, i.params.taskId!),
  )
  route('patch', task, schema.taskUpdate, empty, (a, i) =>
    service.updateTask(a, i.params.workspaceId!, i.params.projectId!, i.params.taskId!, i.body),
  )
  route('patch', task + '/move', schema.moveBody, empty, (a, i) =>
    service.updateTask(
      a,
      i.params.workspaceId!,
      i.params.projectId!,
      i.params.taskId!,
      { version: i.body.version, status: i.body.status },
      { boardVersion: i.body.boardVersion, beforeId: i.body.beforeId },
    ),
  )
  route('get', project + '/board', none, schema.boardQuery, (a, i) =>
    service.board(a, i.params.workspaceId!, i.params.projectId!, i.query),
  )
  route('get', task + '/subtasks', none, schema.taskQuery, async (a, i) => {
    await service.task(a, i.params.workspaceId!, i.params.projectId!, i.params.taskId!)
    return service.tasks(
      a,
      i.params.workspaceId!,
      { ...i.query, parentTaskId: i.params.taskId! },
      i.params.projectId!,
    )
  })
  route(
    'post',
    task + '/subtasks',
    schema.subtaskCreate,
    empty,
    (a, i) =>
      service.createTask(a, i.params.workspaceId!, i.params.projectId!, {
        ...i.body,
        parentTaskId: i.params.taskId!,
      }),
    201,
  )
  route('get', task + '/comments', none, schema.pageQuery, (a, i) =>
    service.comments(a, i.params.workspaceId!, i.params.projectId!, i.params.taskId!, i.query),
  )
  route(
    'post',
    task + '/comments',
    schema.commentCreate,
    empty,
    (a, i) =>
      service.comment(a, i.params.workspaceId!, i.params.projectId!, i.params.taskId!, i.body),
    201,
  )
  route('patch', task + '/comments/:commentId', schema.commentUpdate, empty, (a, i) =>
    service.comment(
      a,
      i.params.workspaceId!,
      i.params.projectId!,
      i.params.taskId!,
      i.body,
      i.params.commentId!,
    ),
  )
  route('delete', task + '/comments/:commentId', schema.versionBody, empty, (a, i) =>
    service.comment(
      a,
      i.params.workspaceId!,
      i.params.projectId!,
      i.params.taskId!,
      i.body,
      i.params.commentId!,
    ),
  )
  route('get', project + '/activity', none, schema.pageQuery, (a, i) =>
    service.activity(a, i.params.workspaceId!, i.params.projectId!, i.query),
  )
  route('get', task + '/activity', none, schema.pageQuery, (a, i) =>
    service.activity(a, i.params.workspaceId!, i.params.projectId!, i.query, i.params.taskId!),
  )
  route('get', root + '/dashboard', none, empty, (a, i) =>
    service.dashboard(a, i.params.workspaceId!),
  )
  return router
}
