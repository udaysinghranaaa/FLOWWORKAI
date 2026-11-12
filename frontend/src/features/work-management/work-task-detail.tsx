import { useState } from 'react'
import { useParams, Link } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { workApi } from '@/services/work-api'
import { Card, Badge } from '@/components/ui/display'
import { Button } from '@/components/ui/button'
import { ConfirmationDialog } from '@/components/ui/overlays'
import { TenantHeading, TenantError } from '@/features/workspaces/tenant-context'
import { useWorkScope, useWorkConfig, errorMessage } from './use-work'
import { TaskForm } from './work-forms'
import { Comments, ActivityList } from './work-collaboration'
import { Pager, PendingWork, TaskRows } from './work-ui'
export default function RealTaskDetail() {
  const { projectId = '', taskId = '' } = useParams(),
    { ws, key, refresh } = useWorkScope(),
    config = useWorkConfig(),
    [editing, setEditing] = useState(false),
    [creating, setCreating] = useState(false),
    [archive, setArchive] = useState(false),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState(''),
    [cursor, setCursor] = useState<string | null>(null),
    [archived, setArchived] = useState(false)
  const query = useQuery({
    queryKey: [...key, projectId, taskId, 'task'],
    queryFn: ({ signal }) => workApi.task(ws, projectId, taskId, signal),
    retry: false,
    staleTime: 0,
    refetchOnMount: 'always',
  })
  const project = useQuery({
    queryKey: [...key, projectId, 'project'],
    queryFn: ({ signal }) => workApi.project(ws, projectId, signal),
    retry: false,
    staleTime: 0,
    refetchOnMount: 'always',
  })
  const children = useQuery({
    queryKey: [...key, projectId, taskId, 'subtasks', cursor, archived],
    queryFn: ({ signal }) =>
      workApi.tasks(
        ws,
        { parentTaskId: taskId, cursor, archived: archived ? 'all' : 'false' },
        projectId,
        signal,
      ),
    enabled: query.isSuccess,
    retry: false,
    staleTime: 0,
  })
  if (
    query.isPending ||
    project.isPending ||
    (!query.isFetchedAfterMount && !query.isError) ||
    (!project.isFetchedAfterMount && !project.isError)
  )
    return <PendingWork label="Checking task access..." />
  if (query.isError || project.isError)
    return (
      <TenantError
        error={query.error ?? project.error}
        retry={() => {
          void query.refetch()
          void project.refetch()
        }}
      />
    )
  const task = query.data,
    canEdit =
      !!task.permissions?.contribute && project.data.status !== 'archived' && !task.archivedAt,
    canRestore =
      !!task.permissions?.contribute && project.data.status !== 'archived' && !!task.archivedAt
  async function toggleArchive() {
    setBusy(true)
    setNotice('')
    try {
      await workApi.updateTask(ws, projectId, taskId, {
        version: task.version,
        archived: !task.archivedAt,
      })
      await refresh()
      setNotice(task.archivedAt ? 'Task restored.' : 'Task archived.')
    } catch (error) {
      setNotice(errorMessage(error))
    } finally {
      setBusy(false)
      setArchive(false)
    }
  }
  return (
    <div className="tenant-page">
      <Link className="text-link" to={`/app/w/${ws}/projects/${projectId}`}>
        Back to {project.data.name}
      </Link>
      <div className="work-heading">
        <div>
          <Badge>
            {config.data?.taskStatuses.find((s) => s.value === task.status)?.label ?? task.status}
          </Badge>
          {task.archivedAt && <Badge>Archived</Badge>}
          <TenantHeading>{task.title}</TenantHeading>
          <p className="muted">Reported by {task.reporter?.name ?? 'Unavailable account'}</p>
        </div>
        <div className="tenant-actions">
          {canEdit && (
            <Button variant="primary" onClick={() => setEditing(true)}>
              Edit task
            </Button>
          )}
          {canEdit && !task.parentTaskId && (
            <Button onClick={() => setCreating(true)}>Add subtask</Button>
          )}
          {canEdit && (
            <Button disabled={busy} onClick={() => setArchive(true)}>
              Archive task
            </Button>
          )}
          {canRestore && (
            <Button
              disabled={busy}
              onClick={() => {
                void toggleArchive()
              }}
            >
              Restore task
            </Button>
          )}
        </div>
      </div>
      {notice && <p role="status">{notice}</p>}
      <div className="tenant-grid">
        <Card>
          <h2>Assignment</h2>
          <p>{task.assignee?.name ?? 'Unassigned'}</p>
          {task.assigneeId && task.assigneeEligible === false && (
            <p role="status">
              This assignee no longer has eligible project access. Reassign or unassign the task.
            </p>
          )}
          <p className="muted">
            Priority:{' '}
            {config.data?.priorities.find((p) => p.value === task.priority)?.label ?? task.priority}
          </p>
        </Card>
        <Card>
          <h2>Schedule</h2>
          <p>Start: {task.startDate ?? 'Not set'}</p>
          <p>Due: {task.dueDate ?? 'Not set'}</p>
        </Card>
      </div>
      <Card>
        <h2>Description</h2>
        <p className="work-description">{task.description || 'No description yet.'}</p>
        <div className="tenant-actions">
          {task.labels.map((label) => (
            <Badge key={label}>{label}</Badge>
          ))}
        </div>
      </Card>
      {task.parentTaskId ? (
        <p>
          Subtask of{' '}
          <Link
            className="text-link"
            to={`/app/w/${ws}/projects/${projectId}/tasks/${task.parentTaskId}`}
          >
            parent task
          </Link>
        </p>
      ) : (
        <Card>
          <div className="work-heading">
            <h2>
              Subtasks - {task.subtasks?.done ?? 0} / {task.subtasks?.total ?? 0} completed
            </h2>
            <Button
              aria-pressed={archived}
              onClick={() => {
                setArchived((value) => !value)
                setCursor(null)
              }}
            >
              {archived ? 'Hide archived subtasks' : 'Show archived subtasks'}
            </Button>
          </div>
          {children.isPending ? (
            <PendingWork />
          ) : children.isError ? (
            <TenantError
              error={children.error}
              retry={() => {
                void children.refetch()
              }}
            />
          ) : (
            <>
              <TaskRows tasks={children.data.items} ws={ws} />
              <Pager cursor={cursor} next={children.data.nextCursor} onPage={setCursor} />
            </>
          )}
          <p className="muted">
            Completing subtasks does not automatically complete their parent. Restored parents keep
            children archived until separately restored.
          </p>
        </Card>
      )}
      <Comments
        projectId={projectId}
        taskId={taskId}
        canWrite={canEdit}
        canModerate={!!task.permissions?.moderate}
      />
      <ActivityList projectId={projectId} taskId={taskId} />
      {editing && (
        <TaskForm projectId={projectId} record={task} close={() => setEditing(false)} />
      )}{' '}
      {creating && (
        <TaskForm projectId={projectId} parentId={taskId} close={() => setCreating(false)} />
      )}
      <ConfirmationDialog
        open={archive}
        onOpenChange={setArchive}
        title="Archive this task?"
        description="Its subtasks will also be archived. Nothing is permanently deleted."
        onConfirm={() => {
          void toggleArchive()
        }}
      />
    </div>
  )
}
