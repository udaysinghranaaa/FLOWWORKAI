import { useState } from 'react'
import { Link } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Card, Badge, LoadingState } from '@/components/ui/display'
import { Field, Input, Select } from '@/components/ui/fields'
import { workApi, type Filters, type Option, type WorkTask } from '@/services/work-api'
import { tenantApi } from '@/services/tenant-api'
import { useWorkConfig, useWorkScope } from './use-work'
export function Pager({
  cursor,
  next,
  onPage,
}: {
  cursor: string | null
  next: string | null
  onPage: (value: string | null) => void
}) {
  return (
    <div className="tenant-actions">
      {cursor && <Button onClick={() => onPage(null)}>First page</Button>}
      {next && <Button onClick={() => onPage(next)}>Next page</Button>}
    </div>
  )
}
export function Options({ values, all = false }: { values: Option[]; all?: boolean }) {
  return (
    <>
      {all && <option value="">All</option>}
      {values.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </>
  )
}
export function WorkFilters({
  kind,
  onChange,
  mine = false,
  projectFilter = false,
}: {
  kind: 'project' | 'task'
  onChange: (filters: Filters) => void
  mine?: boolean
  projectFilter?: boolean
}) {
  const config = useWorkConfig()
  const { ws, key } = useWorkScope()
  const [projectCursor, setProjectCursor] = useState<string | null>(null)
  const [memberCursor, setMemberCursor] = useState<string | null>(null)
  const projects = useQuery({
    queryKey: [...key, 'filter-projects', projectCursor],
    queryFn: () => workApi.projects(ws, { limit: 50, cursor: projectCursor }),
    enabled: kind === 'task' && projectFilter,
    retry: false,
  })
  const members = useQuery({
    queryKey: [...key, 'filter-assignees', memberCursor],
    queryFn: () => tenantApi.members('workspaces', ws, memberCursor),
    enabled: kind === 'task' && !mine,
    retry: false,
  })
  if (!config.data) return null
  return (
    <form
      className="work-filters"
      onSubmit={(event) => {
        event.preventDefault()
        const values = Object.fromEntries(new FormData(event.currentTarget).entries())
        onChange(
          Object.fromEntries(Object.entries(values).map(([key, value]) => [key, String(value)])),
        )
      }}
    >
      <Field id="work-search" label="Search">
        <Input
          id="work-search"
          name="search"
          placeholder={kind === 'project' ? 'Search projects' : 'Search tasks'}
          maxLength={100}
        />
      </Field>
      <Field id="work-status" label="Status">
        <Select id="work-status" name="status">
          <Options
            values={kind === 'project' ? config.data.projectStatuses : config.data.taskStatuses}
            all
          />
        </Select>
      </Field>
      {kind === 'task' && (
        <>
          {projectFilter && (
            <Field id="work-project-filter" label="Project">
              <Select id="work-project-filter" name="projectId">
                <option value="">All accessible projects</option>
                {projects.data?.items.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </Select>
              {projects.data?.nextCursor && (
                <Button size="small" onClick={() => setProjectCursor(projects.data!.nextCursor)}>
                  More project options
                </Button>
              )}
              {projectCursor && (
                <Button size="small" onClick={() => setProjectCursor(null)}>
                  First project options
                </Button>
              )}
              {projects.isError && (
                <Button
                  onClick={() => {
                    void projects.refetch()
                  }}
                >
                  Retry project options
                </Button>
              )}
            </Field>
          )}
          <Field id="work-priority" label="Priority">
            <Select id="work-priority" name="priority">
              <Options values={config.data.priorities} all />
            </Select>
          </Field>
          {!mine && (
            <Field id="work-assignee" label="Assignment">
              <Select id="work-assignee" name="assigneeId">
                <option value="">Anyone</option>
                <option value="me">Assigned to me</option>
                <option value="unassigned">Unassigned</option>
                {members.data?.items.map((member) => (
                  <option key={member.id} value={member.userId}>
                    {member.name}
                  </option>
                ))}
              </Select>
              {members.data?.nextCursor && (
                <Button size="small" onClick={() => setMemberCursor(members.data!.nextCursor)}>
                  More assignee options
                </Button>
              )}
              {memberCursor && (
                <Button size="small" onClick={() => setMemberCursor(null)}>
                  First assignee options
                </Button>
              )}
              {members.isError && (
                <Button
                  onClick={() => {
                    void members.refetch()
                  }}
                >
                  Retry assignee options
                </Button>
              )}
            </Field>
          )}
          <Field id="work-due-after" label="Due from">
            <Input id="work-due-after" name="dueAfter" type="date" />
          </Field>
          <Field id="work-due-before" label="Due before">
            <Input id="work-due-before" name="dueBefore" type="date" />
          </Field>
          <Field id="work-archived" label="Task visibility">
            <Select id="work-archived" name="archived">
              <option value="false">Active</option>
              <option value="true">Archived</option>
              <option value="all">All records</option>
            </Select>
          </Field>
        </>
      )}
      <Field id="work-sort" label="Sort">
        <Select id="work-sort" name="sort">
          <option value="updatedAt">Recently updated</option>
          <option value="createdAt">Recently created</option>
          {kind === 'task' && <option value="dueDate">Due date (earliest first)</option>}
        </Select>
      </Field>
      <Button type="submit">Apply filters</Button>
    </form>
  )
}
export function TaskRows({
  tasks,
  ws,
  quickStatus,
}: {
  tasks: WorkTask[]
  ws: string
  quickStatus?: (task: WorkTask, status: string) => Promise<void>
}) {
  const config = useWorkConfig(),
    [busy, setBusy] = useState<string | null>(null)
  return (
    <div className="tenant-table">
      <table>
        <thead>
          <tr>
            <th>Task</th>
            <th>Status</th>
            <th>Priority</th>
            <th>Assignee</th>
            <th>Due</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((task) => (
            <tr key={task.id}>
              <td>
                <Link
                  className="text-link"
                  to={`/app/w/${ws}/projects/${task.projectId}/tasks/${task.id}`}
                >
                  {task.title}
                </Link>
                {task.parentTaskId && <small className="muted"> - Subtask</small>}
                {task.projectName && <p className="muted">{task.projectName}</p>}
              </td>
              <td>
                {quickStatus && task.canEdit && config.data ? (
                  <Select
                    aria-label={`Status for ${task.title}`}
                    value={task.status}
                    disabled={!!busy}
                    onChange={async (event) => {
                      setBusy(task.id)
                      try {
                        await quickStatus(task, event.target.value)
                      } finally {
                        setBusy(null)
                      }
                    }}
                  >
                    <Options values={config.data.taskStatuses} />
                  </Select>
                ) : (
                  <Badge>
                    {config.data?.taskStatuses.find((s) => s.value === task.status)?.label ??
                      task.status}
                  </Badge>
                )}
                {task.archivedAt && <Badge>Archived</Badge>}
              </td>
              <td>
                <Badge
                  tone={
                    task.priority === 'urgent'
                      ? 'rose'
                      : task.priority === 'high'
                        ? 'amber'
                        : 'neutral'
                  }
                >
                  {config.data?.priorities.find((p) => p.value === task.priority)?.label ??
                    task.priority}
                </Badge>
              </td>
              <td>{task.assignee?.name ?? 'Unassigned'}</td>
              <td>{task.dueDate ?? 'No due date'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {!tasks.length && <p className="muted">No tasks match these filters.</p>}
    </div>
  )
}
export function PendingWork({ label = 'Loading workspace records...' }: { label?: string }) {
  return (
    <Card>
      <LoadingState label={label} />
    </Card>
  )
}
