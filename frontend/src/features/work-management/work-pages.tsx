import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router'
import { Card, Badge, Avatar } from '@/components/ui/display'
import { Button } from '@/components/ui/button'
import { ConfirmationDialog } from '@/components/ui/overlays'
import { TenantHeading, TenantError } from '@/features/workspaces/tenant-context'
import { useWorkScope, useWorkConfig, errorMessage } from './use-work'
import { workApi, type Filters } from '@/services/work-api'
import { ProjectForm, TaskForm } from './work-forms'
import { WorkFilters, Pager, PendingWork, TaskRows } from './work-ui'
import RealKanban from './work-kanban'
import { ProjectTeam, ActivityList } from './work-collaboration'
export default function RealProjects() {
  const { ws, key, scope } = useWorkScope(),
    [filters, setFilters] = useState<Filters>({}),
    [cursor, setCursor] = useState<string | null>(null),
    [creating, setCreating] = useState(false)
  const projects = useQuery({
    queryKey: [...key, 'projects', filters, cursor],
    queryFn: ({ signal }) => workApi.projects(ws, { ...filters, cursor }, signal),
    retry: false,
    staleTime: 0,
    refetchOnMount: 'always',
  })
  return (
    <div className="tenant-page">
      <div className="work-heading">
        <div>
          <Badge tone="violet">{scope.organization.name}</Badge>
          <TenantHeading>Projects</TenantHeading>
          <p className="muted">A clear view of the work your team can access.</p>
        </div>
        {['OWNER', 'ADMIN', 'MANAGER'].includes(scope.role) &&
          scope.workspace.status === 'active' &&
          scope.organization.status === 'active' && (
            <Button variant="primary" onClick={() => setCreating(true)}>
              Create project
            </Button>
          )}
      </div>
      <WorkFilters
        kind="project"
        onChange={(values) => {
          setFilters(values)
          setCursor(null)
        }}
      />
      {projects.isPending || (!projects.isFetchedAfterMount && !projects.isError) ? (
        <PendingWork />
      ) : projects.isError ? (
        <TenantError
          error={projects.error}
          retry={() => {
            void projects.refetch()
          }}
        />
      ) : (
        <>
          <div className="tenant-grid">
            {projects.data.items.map((project) => (
              <Card key={project.id} className="work-project-card">
                <div className="work-heading">
                  <Badge tone={project.color}>{project.status.replaceAll('_', ' ')}</Badge>
                  <Badge>{project.priority}</Badge>
                </div>
                <h2>
                  <Link to={`/app/w/${ws}/projects/${project.id}`}>{project.name}</Link>
                </h2>
                <p className="muted work-clamp">
                  {project.description || 'A fresh space for your next milestone.'}
                </p>
                <div className="work-person">
                  <Avatar name={project.owner?.name ?? 'Project owner'} size="small" />
                  <span>{project.owner?.name ?? 'Owner unavailable'}</span>
                </div>
                <p>
                  {project.completedTasks ?? 0} / {project.totalTasks ?? 0} tasks completed
                </p>
                <progress
                  aria-label={`${project.name} task progress`}
                  value={project.completedTasks ?? 0}
                  max={Math.max(1, project.totalTasks ?? 0)}
                />
                <p className="muted">Due {project.dueDate ?? 'not set'}</p>
                <div className="avatar-row">
                  {project.members?.map((member) => (
                    <Avatar key={member.id} name={member.name} size="small" />
                  ))}
                </div>
              </Card>
            ))}
          </div>
          {!projects.data.items.length && (
            <Card>
              <h2>No projects match yet</h2>
              <p>
                Create a project or ask a project manager for access. The public demo stays
                separate.
              </p>
            </Card>
          )}
          <Pager cursor={cursor} next={projects.data.nextCursor} onPage={setCursor} />
        </>
      )}
      {creating && <ProjectForm close={() => setCreating(false)} />}
    </div>
  )
}
export function RealProjectDetail() {
  const { projectId = '' } = useParams(),
    { ws, key, refresh } = useWorkScope(),
    config = useWorkConfig(),
    [edit, setEdit] = useState(false),
    [create, setCreate] = useState(false),
    [tab, setTab] = useState('list'),
    [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false),
    [archive, setArchive] = useState(false)
  const query = useQuery({
    queryKey: [...key, projectId, 'project'],
    queryFn: ({ signal }) => workApi.project(ws, projectId, signal),
    retry: false,
    staleTime: 0,
    refetchOnMount: 'always',
  })
  if (query.isPending || (!query.isFetchedAfterMount && !query.isError))
    return <PendingWork label="Checking project access..." />
  if (query.isError)
    return (
      <TenantError
        error={query.error}
        retry={() => {
          void query.refetch()
        }}
      />
    )
  const project = query.data,
    canEdit = project.permissions?.manage && project.status !== 'archived',
    canTask = project.permissions?.contribute && project.status !== 'archived'
  async function status(value: string) {
    setBusy(true)
    setNotice('')
    try {
      await workApi.updateProject(ws, projectId, { version: project.version, status: value })
      await refresh()
      setNotice('Project updated.')
    } catch (error) {
      setNotice(errorMessage(error))
    } finally {
      setBusy(false)
      setArchive(false)
    }
  }
  return (
    <div className="tenant-page">
      <Link to={`/app/w/${ws}/projects`} className="text-link">
        All projects
      </Link>
      <div className="work-heading">
        <div>
          <Badge tone={project.color}>
            {config.data?.projectStatuses.find((s) => s.value === project.status)?.label ??
              project.status}
          </Badge>
          <TenantHeading>{project.name}</TenantHeading>
          <p className="muted">
            Owner: {project.owner?.name ?? 'Unavailable'} - Due {project.dueDate ?? 'not set'}
          </p>
        </div>
        <div className="tenant-actions">
          {canEdit && <Button onClick={() => setEdit(true)}>Edit project</Button>}
          {canTask && (
            <Button variant="primary" onClick={() => setCreate(true)}>
              Create task
            </Button>
          )}
          {canEdit && (
            <Button disabled={busy} onClick={() => setArchive(true)}>
              Archive project
            </Button>
          )}
          {project.permissions?.manage && project.status === 'archived' && (
            <Button
              disabled={busy}
              onClick={() => {
                void status(project.previousStatus)
              }}
            >
              Restore project
            </Button>
          )}
        </div>
      </div>
      <Card>
        <p className="work-description">{project.description || 'No project description yet.'}</p>
        <h2>Project progress</h2>
        <p>
          {project.completedTasks ?? 0} / {project.totalTasks ?? 0} tasks completed
        </p>
        <progress
          aria-label="Project task progress"
          value={project.completedTasks ?? 0}
          max={Math.max(1, project.totalTasks ?? 0)}
        />
      </Card>
      {notice && <p role="status">{notice}</p>}
      <div className="work-tabs" role="group" aria-label="Project views">
        {[
          ['list', 'Task list'],
          ['board', 'Kanban board'],
          ['team', 'Project members'],
          ['activity', 'Activity history'],
        ].map(([value, label]) => (
          <Button
            key={value}
            variant={tab === value ? 'primary' : 'secondary'}
            aria-pressed={tab === value}
            onClick={() => setTab(value!)}
          >
            {label}
          </Button>
        ))}
      </div>
      {tab === 'list' && <RealTasks projectId={projectId} embedded />}
      {tab === 'board' && <RealKanban projectId={projectId} />}{' '}
      {tab === 'team' && <ProjectTeam project={project} />}{' '}
      {tab === 'activity' && <ActivityList projectId={projectId} />}
      {edit && <ProjectForm record={project} close={() => setEdit(false)} />}{' '}
      {create && <TaskForm projectId={projectId} close={() => setCreate(false)} />}
      <ConfirmationDialog
        open={archive}
        onOpenChange={setArchive}
        title="Archive this project?"
        description="Tasks and history remain saved. Editing is disabled until the project is restored."
        onConfirm={() => {
          void status('archived')
        }}
      />
    </div>
  )
}
export function RealTasks({
  mine = false,
  projectId,
  embedded = false,
}: {
  mine?: boolean
  projectId?: string
  embedded?: boolean
}) {
  const { ws, key, refresh } = useWorkScope(),
    [filters, setFilters] = useState<Filters>({}),
    [cursor, setCursor] = useState<string | null>(null),
    [notice, setNotice] = useState('')
  const query = useQuery({
    queryKey: [...key, projectId ?? 'workspace', mine ? 'my-tasks' : 'tasks', filters, cursor],
    queryFn: ({ signal }) =>
      workApi.tasks(
        ws,
        { ...filters, ...(mine ? { assigneeId: 'me' } : {}), cursor },
        projectId,
        signal,
      ),
    retry: false,
    staleTime: 0,
    refetchOnMount: 'always',
  })
  return (
    <div className="tenant-page">
      {!embedded && <TenantHeading>{mine ? 'My Tasks' : 'Tasks'}</TenantHeading>}
      <WorkFilters
        kind="task"
        projectFilter={!projectId}
        mine={mine}
        onChange={(values) => {
          setFilters(values)
          setCursor(null)
        }}
      />
      {notice && <p role="status">{notice}</p>}
      {query.isPending || (!query.isFetchedAfterMount && !query.isError) ? (
        <PendingWork />
      ) : query.isError ? (
        <TenantError
          error={query.error}
          retry={() => {
            void query.refetch()
          }}
        />
      ) : (
        <Card>
          <TaskRows
            tasks={query.data.items}
            ws={ws}
            quickStatus={async (task, status) => {
              setNotice('')
              try {
                await workApi.updateTask(ws, task.projectId, task.id, {
                  version: task.version,
                  status,
                })
                await refresh()
                setNotice('Task updated.')
              } catch (error) {
                setNotice(errorMessage(error))
                await refresh()
              }
            }}
          />
          <Pager cursor={cursor} next={query.data.nextCursor} onPage={setCursor} />
        </Card>
      )}
    </div>
  )
}
export function RealMetrics() {
  const { ws, key } = useWorkScope()
  const query = useQuery({
    queryKey: [...key, 'dashboard'],
    queryFn: ({ signal }) => workApi.dashboard(ws, signal),
    retry: false,
    staleTime: 0,
    refetchOnMount: 'always',
  })
  if (query.isPending || (!query.isFetchedAfterMount && !query.isError))
    return <PendingWork label="Loading workspace metrics..." />
  if (query.isError)
    return (
      <TenantError
        error={query.error}
        retry={() => {
          void query.refetch()
        }}
      />
    )
  const data = query.data
  return (
    <>
      <div className="tenant-grid">
        {[
          ['Total projects', data.totalProjects],
          ['Active projects', data.activeProjects],
          ['Total tasks', data.tasks.total],
          ['Todo tasks', data.tasks.todo],
          ['In-progress tasks', data.tasks.inProgress],
          ['Completed tasks', data.tasks.done],
          ['Overdue tasks', data.tasks.overdue],
          ['My assigned tasks', data.tasks.mine],
        ].map(([label, value]) => (
          <Card key={label}>
            <h2>{label}</h2>
            <strong className="tenant-number">{value}</strong>
          </Card>
        ))}
      </div>
      <Card>
        <h2>Upcoming deadlines</h2>
        <TaskRows tasks={data.upcoming} ws={ws} />
      </Card>
      <Card>
        <h2>Recently updated projects</h2>
        {data.recentProjects.length ? (
          <ul>
            {data.recentProjects.map((p) => (
              <li key={p.id}>
                <Link className="text-link" to={`/app/w/${ws}/projects/${p.id}`}>
                  {p.name}
                </Link>{' '}
                - {p.status.replaceAll('_', ' ')}
              </li>
            ))}
          </ul>
        ) : (
          <p>No projects yet. Create your first project when you are ready.</p>
        )}
        <Button asChild>
          <Link to={`/app/w/${ws}/projects`}>Open projects</Link>
        </Button>
      </Card>
    </>
  )
}
