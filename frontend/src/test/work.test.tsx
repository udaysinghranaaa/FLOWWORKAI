import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest'
import { render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route, Outlet } from 'react-router'
import { Providers } from '@/app/providers'
import { api } from '@/services/api-client'
import { tenantApi, type WorkspaceContext } from '@/services/tenant-api'
import {
  workApi,
  type WorkProject,
  type WorkTask,
  type WorkConfig,
  type Board,
} from '@/services/work-api'
import RealProjects, { RealMetrics, RealTasks } from '@/features/work-management/work-pages'
import { ProjectForm, TaskForm } from '@/features/work-management/work-forms'
import RealKanban from '@/features/work-management/work-kanban'
import { Comments } from '@/features/work-management/work-collaboration'
const identity = {
  id: 'controlled-user',
  name: 'Controlled User',
  email: 'controlled@example.com',
  emailVerified: true,
  accountStatus: 'active',
  avatarUrl: null,
}
const config: WorkConfig = {
  defaults: { projectStatus: 'planned', taskStatus: 'todo', priority: 'medium' },
  colors: ['violet', 'blue'],
  projectStatuses: [
    { value: 'planned', label: 'Planned' },
    { value: 'active', label: 'Active' },
    { value: 'on_hold', label: 'On Hold' },
    { value: 'completed', label: 'Completed' },
    { value: 'archived', label: 'Archived' },
  ],
  taskStatuses: [
    { value: 'todo', label: 'Todo' },
    { value: 'in_progress', label: 'In Progress' },
    { value: 'in_review', label: 'In Review' },
    { value: 'done', label: 'Done' },
  ],
  priorities: [
    { value: 'low', label: 'Low' },
    { value: 'medium', label: 'Medium' },
    { value: 'high', label: 'High' },
    { value: 'urgent', label: 'Urgent' },
  ],
}
const project: WorkProject = {
  id: 'project-one',
  workspaceId: 'workspace-one',
  organizationId: 'company-one',
  name: 'Database Solar Project',
  slug: 'solar-project',
  description: 'Persisted project description',
  ownerUserId: identity.id,
  owner: { id: identity.id, name: identity.name },
  createdBy: identity.id,
  status: 'active',
  previousStatus: 'planned',
  priority: 'medium',
  color: 'violet',
  startDate: null,
  dueDate: '2026-12-01',
  version: 3,
  createdAt: '2026-11-12T00:00:00.000Z',
  updatedAt: '2026-11-12T00:00:00.000Z',
  totalTasks: 4,
  completedTasks: 1,
  permissions: { read: true, manage: true, contribute: true, moderate: true },
}
const task: WorkTask = {
  id: 'task-one',
  projectId: project.id,
  workspaceId: project.workspaceId,
  title: 'Database Task',
  description: 'Task description',
  status: 'todo',
  priority: 'medium',
  assigneeId: null,
  createdBy: identity.id,
  parentTaskId: null,
  labels: [],
  startDate: null,
  dueDate: null,
  completedAt: null,
  archivedAt: null,
  position: 1024,
  version: 1,
  createdAt: project.createdAt,
  updatedAt: project.updatedAt,
  canEdit: true,
}
const empty = { items: [], nextCursor: null, hasMore: false }
function view(element: React.ReactNode, role = 'OWNER') {
  const context = {
    organization: { id: 'company-one', name: 'Company One', status: 'active' },
    workspace: { id: 'workspace-one', name: 'Workspace One', status: 'active' },
    role,
    permissions: [],
    memberCount: 1,
    pendingInvitations: 0,
  } as unknown as WorkspaceContext
  return render(
    <Providers>
      <MemoryRouter initialEntries={['/real']}>
        <Routes>
          <Route element={<Outlet context={context} />}>
            <Route path="/real" element={element} />
          </Route>
        </Routes>
      </MemoryRouter>
    </Providers>,
  )
}
beforeEach(() => {
  vi.spyOn(api, 'currentUser').mockResolvedValue(identity)
  vi.spyOn(workApi, 'config').mockResolvedValue(config)
  vi.spyOn(tenantApi, 'members').mockResolvedValue(empty)
  vi.spyOn(workApi, 'members').mockResolvedValue({
    items: [
      {
        id: 'project-membership',
        userId: identity.id,
        name: identity.name,
        role: 'MANAGER',
        eligible: true,
      },
    ],
    nextCursor: null,
    hasMore: false,
  })
})
afterEach(() => vi.restoreAllMocks())
describe('real project and task UI', () => {
  it('renders server projects and real progress without using demo fixtures', async () => {
    vi.spyOn(workApi, 'projects').mockResolvedValue({
      items: [project],
      nextCursor: null,
      hasMore: false,
    })
    view(<RealProjects />)
    expect(await screen.findByRole('heading', { name: project.name })).toBeVisible()
    expect(screen.getByText('1 / 4 tasks completed')).toBeVisible()
    expect(screen.queryByText('Orbit brand refresh')).not.toBeInTheDocument()
  })
  it('renders honest empty and API denial states with retry', async () => {
    const projects = vi
      .spyOn(workApi, 'projects')
      .mockRejectedValue(new Error('This resource is unavailable.'))
    view(<RealProjects />)
    expect(await screen.findByText('This resource is unavailable.')).toBeVisible()
    projects.mockResolvedValue(empty)
    await userEvent.setup().click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByRole('heading', { name: 'No projects match yet' })).toBeVisible()
  })
  it('hides project creation for viewers', async () => {
    vi.spyOn(workApi, 'projects').mockResolvedValue(empty)
    view(<RealProjects />, 'VIEWER')
    await screen.findByRole('heading', { name: 'No projects match yet' })
    expect(screen.queryByRole('button', { name: 'Create project' })).not.toBeInTheDocument()
  })
  it('validates project form and waits for real API confirmation', async () => {
    const create = vi.spyOn(workApi, 'createProject').mockResolvedValue(project),
      close = vi.fn()
    view(<ProjectForm close={close} />)
    const user = userEvent.setup()
    await screen.findByLabelText('Project name')
    await user.click(screen.getByRole('button', { name: 'Create project' }))
    expect(create).not.toHaveBeenCalled()
    await user.type(screen.getByLabelText('Project name'), 'New Solar Project')
    await user.type(screen.getByLabelText('Project key'), 'new-solar-project')
    await user.click(screen.getByRole('button', { name: 'Create project' }))
    await waitFor(() => expect(close).toHaveBeenCalled())
    expect(create.mock.calls[0]![0]).toBe('workspace-one')
    expect(create.mock.calls[0]![1]).toMatchObject({
      name: 'New Solar Project',
      slug: 'new-solar-project',
      creationKey: expect.stringMatching(/^[a-f0-9-]{36}$/),
    })
  })
  it('retains form and creation key after a failed project mutation', async () => {
    const create = vi
        .spyOn(workApi, 'createProject')
        .mockRejectedValue(new Error('Network unavailable')),
      close = vi.fn()
    view(<ProjectForm close={close} />)
    const user = userEvent.setup()
    await user.type(await screen.findByLabelText('Project name'), 'New Project')
    await user.type(screen.getByLabelText('Project key'), 'new-project')
    await user.click(screen.getByRole('button', { name: 'Create project' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Network unavailable')
    await user.click(screen.getByRole('button', { name: 'Create project' }))
    expect((create.mock.calls[0]![1] as { creationKey: string }).creationKey).toBe(
      (create.mock.calls[1]![1] as { creationKey: string }).creationKey,
    )
    expect(close).not.toHaveBeenCalled()
  })
  it('creates a real task with eligible assignment, labels and API status codes', async () => {
    const create = vi.spyOn(workApi, 'createTask').mockResolvedValue(task),
      close = vi.fn()
    view(<TaskForm projectId={project.id} close={close} />)
    const user = userEvent.setup()
    await user.type(await screen.findByLabelText('Task title'), 'New Task')
    await screen.findByRole('option', { name: identity.name })
    await user.selectOptions(screen.getByLabelText('Assignee'), identity.id)
    await user.selectOptions(screen.getByLabelText('Task status'), 'in_review')
    await user.type(screen.getByLabelText('Labels (comma separated)'), 'review, launch')
    await user.click(screen.getByRole('button', { name: 'Create task' }))
    await waitFor(() => expect(close).toHaveBeenCalled())
    expect(create.mock.calls[0]).toEqual([
      'workspace-one',
      project.id,
      expect.objectContaining({
        title: 'New Task',
        status: 'in_review',
        assigneeId: identity.id,
        labels: ['review', 'launch'],
        parentTaskId: null,
      }),
    ])
  })
  it('preserves the original record version in an edit and surfaces backend conflicts', async () => {
    const update = vi
      .spyOn(workApi, 'updateTask')
      .mockRejectedValue(new Error('This record changed. Refresh before trying again.'))
    view(<TaskForm projectId={project.id} record={task} close={vi.fn()} />)
    await screen.findByLabelText('Task title')
    await userEvent.setup().click(screen.getByRole('button', { name: 'Save task' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('This record changed')
    expect(update.mock.calls[0]![3]).toMatchObject({ version: 1 })
  })
  it('combines My Tasks filters and scopes requests to the active workspace', async () => {
    const tasks = vi
      .spyOn(workApi, 'tasks')
      .mockResolvedValue({ items: [task], nextCursor: null, hasMore: false })
    vi.spyOn(workApi, 'projects').mockResolvedValue(empty)
    view(<RealTasks mine />)
    await screen.findByRole('link', { name: task.title })
    const user = userEvent.setup()
    await user.selectOptions(screen.getByLabelText('Status'), 'todo')
    await user.selectOptions(screen.getByLabelText('Priority'), 'medium')
    await user.click(screen.getByRole('button', { name: 'Apply filters' }))
    await waitFor(() =>
      expect(
        tasks.mock.calls.some(
          (call) =>
            call[0] === 'workspace-one' &&
            call[1]?.assigneeId === 'me' &&
            call[1]?.status === 'todo' &&
            call[1]?.priority === 'medium',
        ),
      ).toBe(true),
    )
  })
  it('rolls back an optimistic board move and announces the failure', async () => {
    const board: Board = {
      version: 2,
      readOnly: false,
      columns: config.taskStatuses.map((status) => ({
        status: status.value,
        items: status.value === 'todo' ? [task] : [],
        total: status.value === 'todo' ? 1 : 0,
        nextCursor: null,
      })),
    }
    vi.spyOn(workApi, 'board').mockResolvedValue(board)
    const move = vi.spyOn(workApi, 'move').mockRejectedValue(new Error('Stale board'))
    view(<RealKanban projectId={project.id} />)
    const control = await screen.findByLabelText('Move Database Task to status')
    await userEvent.setup().selectOptions(control, 'done')
    expect(await screen.findByText('Move rolled back. Stale board')).toBeVisible()
    await waitFor(() =>
      expect(
        within(screen.getByRole('region', { name: 'Todo column' })).getByRole('link', {
          name: task.title,
        }),
      ).toBeVisible(),
    )
    expect(move).toHaveBeenCalledWith('workspace-one', project.id, task.id, {
      version: 1,
      boardVersion: 2,
      status: 'done',
      beforeId: null,
    })
  })
  it('keeps viewer Kanban mutation controls disabled', async () => {
    vi.spyOn(workApi, 'board').mockResolvedValue({
      version: 2,
      readOnly: true,
      columns: [{ status: 'todo', items: [task], total: 1, nextCursor: null }],
    })
    view(<RealKanban projectId={project.id} />, 'VIEWER')
    expect(await screen.findByLabelText('Move Database Task to status')).toBeDisabled()
    expect(screen.getByLabelText('Drag Database Task')).toBeDisabled()
  })
  it('renders comments as text and hides editing from read-only viewers', async () => {
    vi.spyOn(workApi, 'comments').mockResolvedValue({
      items: [
        {
          id: 'comment',
          authorId: identity.id,
          author: { id: identity.id, name: identity.name },
          text: '<script>controlled text</script>',
          version: 1,
          createdAt: project.createdAt,
          updatedAt: project.updatedAt,
        },
      ],
      nextCursor: null,
      hasMore: false,
    })
    const result = view(
      <Comments projectId={project.id} taskId={task.id} canWrite={false} canModerate={false} />,
      'VIEWER',
    )
    expect(await screen.findByText('<script>controlled text</script>')).toBeVisible()
    expect(result.container.querySelector('script')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Edit comment' })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Add a comment')).not.toBeInTheDocument()
  })
  it('renders zero counts from the real dashboard API without invented trends', async () => {
    vi.spyOn(workApi, 'dashboard').mockResolvedValue({
      totalProjects: 0,
      activeProjects: 0,
      tasks: { total: 0, todo: 0, inProgress: 0, done: 0, overdue: 0, mine: 0 },
      upcoming: [],
      recentProjects: [],
    })
    view(<RealMetrics />)
    expect(
      await screen.findByText('No projects yet. Create your first project when you are ready.'),
    ).toBeVisible()
    expect(
      screen.getByRole('heading', { name: 'Total projects' }).nextElementSibling,
    ).toHaveTextContent('0')
    expect(screen.queryByText(/growth/i)).not.toBeInTheDocument()
  })
})
