// Run after build: node scripts/generate-client-contract.mjs. No environment/database access.
import { readFileSync, writeFileSync } from 'node:fs'
import { z } from 'zod'
import console from 'node:console'
import * as S from '../dist/modules/clients/client.schema.js'
import { invitationTokenBody } from '../dist/modules/organizations/tenant.schema.js'
const doc = JSON.parse(readFileSync('openapi.json', 'utf8'))
doc.info.version = '0.7.0'
doc.info.title = 'FlowWork AI - Client collaboration and secure portal'
doc.info.description =
  'Implemented Phases 3-7. Current database identity and scoped authorization on every request. Separate client memberships, explicit grants, allowlisted portal DTOs, publication, feedback, change review and versioned approvals. Live schema rollout requires separate approval.'
doc.tags = [
  ...doc.tags.filter((t) => t.name !== 'Client collaboration'),
  { name: 'Client collaboration' },
]
const root = '/api/v1/workspaces/{workspaceId}/clients',
  c = root + '/{clientId}',
  p = c + '/projects/{projectId}'
const portal = '/api/v1/portal/clients/{clientId}',
  project = portal + '/projects/{projectId}'
const entries = [
  ['get', root, null, true],
  ['post', root, S.createClient, false, 201],
  ['get', c],
  ['patch', c, S.updateClient],
  ['get', c + '/contacts', null, true],
  ['post', c + '/contacts', S.createContact, false, 201],
  ['patch', c + '/contacts/{contactId}', S.updateContact],
  ['get', c + '/invitations', null, true],
  ['post', c + '/invitations', S.invite, false, 201],
  ['post', c + '/invitations/{invitationId}/resend', z.strictObject({})],
  ['post', c + '/invitations/{invitationId}/revoke', z.strictObject({})],
  ['get', c + '/members', null, true],
  ['patch', c + '/members/{membershipId}', S.membership],
  ['get', c + '/projects', null, true],
  ['post', c + '/projects', S.share, false, 201],
  ['get', p],
  ['patch', p, S.updateGrant],
  ['get', c + '/activity', null, true],
  ['post', '/api/v1/portal/invitations/preview', invitationTokenBody],
  ['post', '/api/v1/portal/invitations/accept', invitationTokenBody],
  ['get', '/api/v1/portal/clients', null, true],
  ['get', portal],
  ['get', portal + '/projects', null, true],
  ['get', project],
  ['get', portal + '/members', null, true],
  ['patch', portal + '/members/{membershipId}', S.membership],
]
for (const path of [p, project])
  entries.push(
    ['get', path + '/resources', null, true],
    ['post', path + '/resources', S.createResource, false, 201],
    ['get', path + '/resources/{resourceId}'],
    ['patch', path + '/resources/{resourceId}', S.updateResource],
  )
function shape(s) {
  const json = z.toJSONSchema(s, { target: 'openapi-3.0', io: 'input', unrepresentable: 'any' })
  delete json.$schema
  return json
}
const string = { type: 'string' },
  boolean = { type: 'boolean' },
  number = { type: 'number' }
const grantFields = {
  id: string,
  version: { type: 'integer' },
  projectId: string,
  title: string,
  description: string,
  status: { type: 'string', enum: ['active', 'revoked'] },
  progress: boolean,
  milestones: boolean,
  deliverables: boolean,
  feedback: boolean,
  changes: boolean,
  approve: boolean,
}
const resourceFields = {
  id: string,
  version: { type: 'integer' },
  kind: { type: 'string', enum: S.kinds },
  title: string,
  body: string,
  status: string,
  published: boolean,
  progress: number,
  dueDate: string,
  position: number,
  priority: string,
  parentId: { ...string, nullable: true },
  url: string,
  fileName: string,
  contentType: string,
  size: { ...number, nullable: true },
  revision: number,
  previousId: { ...string, nullable: true },
  decisionAt: { ...string, nullable: true },
  decisionNote: string,
  publishedAt: { ...string, nullable: true },
  createdAt: string,
}
doc.components.schemas.ClientSafeProject = {
  type: 'object',
  additionalProperties: false,
  required: Object.keys(grantFields),
  properties: grantFields,
}
doc.components.schemas.ClientSafeResource = {
  type: 'object',
  additionalProperties: false,
  required: Object.keys(resourceFields),
  properties: resourceFields,
}
doc.components.schemas.ClientSafeResource.properties.canEdit = boolean
for (const [method, path, body, list, status = 200] of entries) {
  const parameters = [...path.matchAll(/\{(\w+)\}/g)].map((m) => ({
    name: m[1],
    in: 'path',
    required: true,
    schema: { type: 'string', pattern: '^[a-f0-9]{24}$' },
  }))
  if (list) {
    const q = shape(S.query)
    for (const [name, schema] of Object.entries(q.properties))
      parameters.push({ name, in: 'query', required: false, schema })
  }
  if (method !== 'get')
    parameters.push({ name: 'X-CSRF-Token', in: 'header', required: true, schema: string })
  const envelope = {
    type: 'object',
    required: ['data', 'meta'],
    properties: {
      data: { type: 'object' },
      meta: { type: 'object', properties: { requestId: string }, required: ['requestId'] },
    },
  }
  if (path.startsWith('/api/v1/portal/clients') && path.endsWith('/resources/{resourceId}'))
    envelope.properties.data = { $ref: '#/components/schemas/ClientSafeResource' }
  if (path === project && method === 'get')
    envelope.properties.data = {
      type: 'object',
      additionalProperties: false,
      required: ['client', 'project', 'role'],
      properties: {
        client: {
          type: 'object',
          properties: { id: string, name: string },
          required: ['id', 'name'],
        },
        project: { $ref: '#/components/schemas/ClientSafeProject' },
        role: string,
      },
    }
  if (path.startsWith('/api/v1/portal/clients') && path.endsWith('/resources') && method === 'get')
    envelope.properties.data = {
      type: 'object',
      required: ['items', 'hasMore', 'nextCursor'],
      properties: {
        items: { type: 'array', items: { $ref: '#/components/schemas/ClientSafeResource' } },
        hasMore: boolean,
        nextCursor: { ...string, nullable: true },
      },
    }
  const responses = {
    [status]: {
      description: 'Authorized result in the existing data/meta envelope.',
      content: { 'application/json': { schema: envelope } },
    },
  }
  for (const [code, description] of Object.entries({
    401: 'Current verified identity required.',
    403: 'CSRF or scoped permission denied.',
    404: 'Resource unavailable in the authorized scope.',
    409: 'Stale version, duplicate key or invalid transition.',
    410: 'Invitation expired, consumed or revoked.',
    422: 'Strict request validation failed.',
    429: 'Rate limit exceeded.',
  }))
    responses[code] = { description }
  const op = {
    tags: ['Client collaboration'],
    operationId: 'client_' + method + '_' + path.replaceAll(/[^a-zA-Z0-9]+/g, '_'),
    summary: method.toUpperCase() + ' ' + path,
    description:
      'Rechecks current tenant/client/project permissions. Lists default to 20 and cap at 50. Project publication requires Phase 6 manage permission. Portal responses expose allowlisted published resources only.',
    parameters,
    security: path.endsWith('/preview')
      ? []
      : [{ [Object.keys(doc.components.securitySchemes)[0]]: [] }],
    responses,
  }
  if (body)
    op.requestBody = { required: true, content: { 'application/json': { schema: shape(body) } } }
  ;(doc.paths[path] ??= {})[method] = op
}
writeFileSync('openapi.json', JSON.stringify(doc, null, 2) + '\n')
writeFileSync(
  '../docs/phase-7-api-inventory.md',
  '# Phase 7 API inventory\n\nExisting envelopes, cookie identity and signed CSRF apply. Preview is token-scoped and rate-limited. Acceptance requires matching verified email. Internal CRM requires workspace OWNER/ADMIN. Project resources require current Phase 6 manage permission. External operations require separate active portal membership and an explicit project grant.\n\n| Method | Path |\n|---|---|\n' +
    entries.map(([m, p]) => '| ' + m.toUpperCase() + ' | `' + p + '` |').join('\n') +
    '\n\nRequest bodies and bounds are generated from executable Zod schemas in backend/openapi.json. ClientSafeProject and ClientSafeResource document external allowlists. For transition policy, see phase-7-architecture.md.\n',
)
console.log(
  JSON.stringify({
    phase7Operations: entries.length,
    totalPathPatterns: Object.keys(doc.paths).length,
  }),
)
