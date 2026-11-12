import { options, useClientQuery, useClientRefresh } from './use-client'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Card, Badge, Progress } from '@/components/ui/display'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/shared/page'
import {
  clientApi,
  clientPath,
  portalPath,
  type ClientResource,
  type Grant,
} from '@/services/client-api'
import { ClientForm, ClientList, Action, QueryState, type FormField } from './client-ui'
const tabs = [
  ['progress', 'Progress'],
  ['milestone', 'Milestones'],
  ['deliverable', 'Deliverables'],
  ['feedback', 'Feedback'],
  ['change', 'Change requests'],
] as const
const transitions: Record<string, Record<string, string[]>> = {
  progress: { draft: ['published', 'archived'], published: ['superseded', 'archived'] },
  milestone: {
    planned: ['in_progress', 'completed', 'delayed', 'archived'],
    in_progress: ['completed', 'delayed', 'archived'],
    completed: ['in_progress', 'archived'],
    delayed: ['in_progress', 'completed', 'archived'],
  },
  feedback: {
    open: ['acknowledged', 'resolved', 'closed'],
    acknowledged: ['resolved', 'closed'],
    resolved: ['open', 'closed'],
  },
  change: {
    submitted: ['under_review'],
    under_review: ['approved', 'rejected'],
    approved: ['completed'],
  },
  deliverable: {
    draft: ['shared', 'archived'],
    shared: ['archived'],
    approved: ['archived'],
    changes_requested: ['archived'],
  },
}
function resourceFields(kind: string, r?: ClientResource, external = false): FormField[] {
  return [
    {
      name: 'title',
      label: kind === 'reply' ? 'Reply subject' : 'Title',
      required: true,
      value: r?.title,
    },
    {
      name: 'body',
      label: kind === 'reply' ? 'Reply' : 'Message',
      type: 'textarea',
      value: r?.body,
    },
    ...(kind === 'progress'
      ? [
          {
            name: 'progress',
            label: 'Approved progress (%)',
            type: 'number' as const,
            max: 100,
            value: r?.progress ?? 0,
          },
          {
            name: 'dueDate',
            label: 'Target delivery date',
            type: 'date' as const,
            value: r?.dueDate,
          },
        ]
      : []),
    ...(kind === 'milestone'
      ? [
          { name: 'dueDate', label: 'Due date', type: 'date' as const, value: r?.dueDate },
          {
            name: 'position',
            label: 'Display order',
            type: 'number' as const,
            max: 1000000,
            value: r?.position ?? 0,
          },
        ]
      : []),
    ...(['milestone', 'feedback', 'reply'].includes(kind) && !external
      ? [
          {
            name: 'published',
            label: 'Visible to this client',
            type: 'checkbox' as const,
            value: r?.published ?? true,
          },
        ]
      : []),
    ...(kind === 'change'
      ? [
          {
            name: 'priority',
            label: 'Suggested priority',
            type: 'select' as const,
            options: options(['low', 'medium', 'high', 'urgent']),
            value: r?.priority ?? 'medium',
          },
        ]
      : []),
    ...(kind === 'deliverable'
      ? [
          {
            name: 'url',
            label: 'HTTPS reference URL',
            type: 'url' as const,
            required: true,
            value: r?.url,
          },
          { name: 'fileName', label: 'Display file name', value: r?.fileName },
          { name: 'contentType', label: 'Content type', value: r?.contentType },
        ]
      : []),
  ]
}
export function ProjectCollaboration({
  clientId,
  projectId,
  ws,
}: {
  clientId: string
  projectId: string
  ws?: string
}) {
  const path = (ws ? clientPath(ws, clientId) : portalPath(clientId)) + '/projects/' + projectId,
    query = useClientQuery<{ project: Grant; role: string }>(path)
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = searchParams.get('section') ?? 'progress'
  const [adding, setAdding] = useState(false),
    refresh = useClientRefresh(),
    external = !ws
  const policy: Record<string, keyof Grant> = {
    progress: 'progress',
    milestone: 'milestones',
    deliverable: 'deliverables',
    feedback: 'feedback',
    change: 'changes',
  }
  const available = tabs.filter(([kind]) => !external || query.data?.project?.[policy[kind]!])
  const current = available.some(([kind]) => kind === tab) ? tab : (available[0]?.[0] ?? '')
  const writable =
    !external || (query.data?.role !== 'CLIENT_VIEWER' && ['feedback', 'change'].includes(current))
  return (
    <QueryState
      pending={query.isPending || (!query.isFetchedAfterMount && !query.isError)}
      error={query.error}
      retry={() => {
        void query.refetch()
      }}
    >
      <div className="client-management">
        <Link to={ws ? `/app/w/${ws}/clients/${clientId}` : `/portal/${clientId}`}>
          {ws ? 'Back to client' : 'Portal overview'}
        </Link>
        <PageHeader
          title={
            external ? (query.data?.project?.title ?? 'Shared project') : 'Client collaboration'
          }
          description={
            external
              ? (query.data?.project?.description ?? '')
              : 'Publish only information approved for this client.'
          }
        />
        <nav className="portal-nav" aria-label="Project collaboration sections">
          {available.map(([kind, label]) => (
            <Button
              key={kind}
              aria-pressed={current === kind}
              onClick={() => {
                setSearchParams({ section: kind }, { replace: true })
                setAdding(false)
              }}
            >
              {label}
            </Button>
          ))}
        </nav>
        {!current && <p>No collaboration sections have been shared yet.</p>}
        {current && (
          <>
            <h2>{tabs.find(([k]) => k === current)?.[1]}</h2>
            {writable && (
              <Button onClick={() => setAdding(!adding)}>
                {current === 'change'
                  ? 'New change request'
                  : current === 'feedback'
                    ? 'Submit feedback'
                    : 'Create ' + current}
              </Button>
            )}
            {adding && (
              <Card>
                <ClientForm
                  key={current}
                  fields={resourceFields(current, undefined, external)}
                  label={
                    current === 'feedback'
                      ? 'Send feedback'
                      : current === 'change'
                        ? 'Submit request'
                        : 'Save draft'
                  }
                  submit={(b, creationKey) =>
                    clientApi.save(path + '/resources', {
                      ...b,
                      kind: current,
                      creationKey,
                    })
                  }
                  after={() => {
                    setAdding(false)
                    void refresh()
                  }}
                />
                {current === 'progress' && (
                  <p>Progress is an agency-approved percentage, not an automatic task count.</p>
                )}
                {current === 'deliverable' && (
                  <p>
                    References are hosted externally. Access and link expiry depend on that
                    provider.
                  </p>
                )}
              </Card>
            )}
            <ClientList<ClientResource>
              key={current}
              path={path + '/resources'}
              filters={{ kind: current, ...(current === 'milestone' ? { sort: 'position' } : {}) }}
              render={(r) => (
                <ResourceCard
                  key={r.id + ':' + r.version}
                  row={r}
                  path={path}
                  external={external}
                  reviewer={query.data?.role !== 'CLIENT_VIEWER' && !!query.data?.project?.approve}
                  contributor={!external || query.data?.role !== 'CLIENT_VIEWER'}
                  ws={ws}
                  projectId={projectId}
                />
              )}
            />
          </>
        )}
      </div>
    </QueryState>
  )
}
function ResourceCard({
  row: r,
  path,
  external,
  reviewer,
  contributor,
  ws,
  projectId,
}: {
  row: ClientResource
  path: string
  external: boolean
  reviewer: boolean
  contributor: boolean
  ws?: string
  projectId: string
}) {
  const refresh = useClientRefresh(),
    [edit, setEdit] = useState(false),
    [reply, setReply] = useState(false),
    [newVersion, setNewVersion] = useState(false)
  const canEdit = external
    ? !!r.canEdit
    : (!['progress', 'deliverable'].includes(r.kind) || r.status === 'draft') &&
      !['archived', 'superseded'].includes(r.status)
  return (
    <Card className="client-resource">
      <div className="tenant-actions">
        <Badge>{r.status.replaceAll('_', ' ')}</Badge>
        {!external && <Badge>{r.published ? 'Client visible' : 'Internal draft'}</Badge>}
        {r.kind === 'deliverable' && <Badge>Version {r.revision}</Badge>}
      </div>
      <h3>{r.title}</h3>
      <p className="client-copy">{r.body}</p>
      {r.kind === 'progress' && (
        <>
          <Progress value={r.progress} />
          <p>{r.progress}% published progress</p>
        </>
      )}
      {r.dueDate && <p>Target: {r.dueDate}</p>}
      {r.kind === 'milestone' && <p>Display order: {r.position}</p>}
      {r.url && /^https:\/\//.test(r.url) && (
        <p>
          <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-link">
            Open {r.fileName || 'external reference'}
          </a>
          <span className="muted"> · Provider controls file access</span>
        </p>
      )}
      {r.decisionAt && (
        <p>
          Decision: {new Date(r.decisionAt).toLocaleString()} · {r.decisionNote || r.status}
        </p>
      )}
      {canEdit && <Button onClick={() => setEdit(!edit)}>Edit {r.kind}</Button>}
      {edit && (
        <ClientForm
          fields={resourceFields(r.kind, r, external)}
          submit={(b) =>
            clientApi.save(path + '/resources/' + r.id, { ...b, version: r.version }, true)
          }
          after={() => {
            setEdit(false)
            void refresh()
          }}
        />
      )}
      {!external && (transitions[r.kind]?.[r.status]?.length ?? 0) > 0 && (
        <ClientForm
          fields={[
            {
              name: 'status',
              label: 'Next status for ' + r.title,
              type: 'select',
              options: options(transitions[r.kind]![r.status]!),
            },
            ...(r.kind === 'change'
              ? [
                  {
                    name: 'decisionNote',
                    label: 'Client-facing review note',
                    type: 'textarea' as const,
                    max: 2000,
                  },
                ]
              : []),
          ]}
          label="Update status"
          submit={(b) =>
            clientApi.save(path + '/resources/' + r.id, { ...b, version: r.version }, true)
          }
          after={() => {
            void refresh()
          }}
        />
      )}
      {external && r.kind === 'deliverable' && r.status === 'shared' && reviewer && (
        <ClientForm
          fields={[
            {
              name: 'status',
              label: 'Review decision for ' + r.title,
              type: 'select',
              options: [
                { value: 'approved', label: 'Approve' },
                { value: 'changes_requested', label: 'Request changes' },
              ],
            },
            { name: 'decisionNote', label: 'Review note', type: 'textarea', max: 2000 },
          ]}
          label="Submit decision"
          submit={(b) =>
            clientApi.save(path + '/resources/' + r.id, { ...b, version: r.version }, true)
          }
          after={() => {
            void refresh()
          }}
        />
      )}
      {!external &&
        r.kind === 'deliverable' &&
        ['shared', 'approved', 'changes_requested'].includes(r.status) && (
          <>
            <Button onClick={() => setNewVersion(!newVersion)}>New deliverable version</Button>
            {newVersion && (
              <ClientForm
                fields={resourceFields('deliverable')}
                label="Create replacement draft"
                submit={(b, creationKey) =>
                  clientApi.save(path + '/resources', {
                    ...b,
                    kind: 'deliverable',
                    previousId: r.id,
                    creationKey,
                  })
                }
                after={() => {
                  setNewVersion(false)
                  void refresh()
                }}
              />
            )}
          </>
        )}
      {!external && ws && r.kind === 'change' && r.status === 'approved' && (
        <details>
          <summary>Link an existing internal task</summary>
          <p>The client will see your decision summary; task details stay internal.</p>
          <ClientList<{ id: string; title: string }>
            path={`/workspaces/${ws}/projects/${projectId}/tasks`}
            render={(t) => (
              <Action
                run={() =>
                  clientApi.save(
                    path + '/resources/' + r.id,
                    { version: r.version, taskId: t.id },
                    true,
                  )
                }
              >
                Link {t.title}
              </Action>
            )}
          />
        </details>
      )}
      {!external && ws && r.taskId && (
        <p>
          <Link to={`/app/w/${ws}/projects/${projectId}/tasks/${r.taskId}`}>Open linked task</Link>
        </p>
      )}
      {r.kind === 'feedback' && (
        <>
          <Button onClick={() => setReply(!reply)}>
            {reply ? 'Hide thread' : 'Open feedback thread'}
          </Button>
          {reply && (
            <>
              <ClientList<ClientResource>
                path={path + '/resources'}
                filters={{ kind: 'reply', parentId: r.id }}
                render={(child) => (
                  <Card>
                    <h4>{child.title}</h4>
                    <p className="client-copy">{child.body}</p>
                    {!external && (
                      <Badge>{child.published ? 'Shared reply' : 'Internal note'}</Badge>
                    )}
                  </Card>
                )}
              />
              {contributor && r.status !== 'closed' && (
                <ClientForm
                  fields={resourceFields('reply', undefined, external)}
                  label="Send reply"
                  submit={(b, creationKey) =>
                    clientApi.save(path + '/resources', {
                      ...b,
                      kind: 'reply',
                      parentId: r.id,
                      creationKey,
                    })
                  }
                  after={() => {
                    void refresh()
                  }}
                />
              )}
            </>
          )}
        </>
      )}
    </Card>
  )
}
