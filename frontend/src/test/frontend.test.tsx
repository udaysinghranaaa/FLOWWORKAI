import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router'
import type { ReactNode } from 'react'
import { Providers } from '@/app/providers'
import { useUIStore } from '@/stores/ui-store'
import LandingPage from '@/features/dashboard/landing-page'
import AuthPage from '@/features/auth/auth-page'
import ProjectsPage from '@/features/projects/projects-page'
import TasksPage from '@/features/tasks/tasks-page'
import TaskForm from '@/features/tasks/task-form'
import NotificationsPage from '@/features/dashboard/notifications-page'
import AppShell from '@/components/layout/app-shell'
import DashboardPage from '@/features/dashboard/dashboard-page'
import TicketDetailPage from '@/features/tickets/ticket-detail'

function renderDemo(
  node: ReactNode,
  initial = '/w/studio/dashboard',
  routePath = '/w/:workspaceId/*',
) {
  return render(
    <Providers>
      <MemoryRouter initialEntries={[initial]}>
        <Routes>
          <Route path={routePath} element={node} />
          <Route path="*" element={node} />
        </Routes>
      </MemoryRouter>
    </Providers>,
  )
}
beforeEach(() => {
  localStorage.clear()
  useUIStore.setState({
    theme: 'dark',
    collapsed: false,
    commandOpen: false,
    taskCreateOpen: false,
  })
})
describe('frontend interactions', () => {
  it('renders the landing page with honest demo entry and all marketing sections', () => {
    renderDemo(<LandingPage />, '/')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('One Workspace.')
    expect(screen.getAllByRole('link', { name: 'Explore Demo Workspace' })[0]).toHaveAttribute(
      'href',
      '/w/studio/dashboard',
    )
    expect(screen.getByRole('heading', { name: /Good questions/ })).toBeInTheDocument()
    expect(screen.getAllByText(/no live services/i).length).toBeGreaterThan(0)
  })
  it('validates login, reveals passwords, and never reports authentication success', async () => {
    const user = userEvent.setup()
    renderDemo(<AuthPage mode="login" />, '/login')
    await user.click(screen.getByRole('button', { name: 'Preview login' }))
    expect(await screen.findByText('Enter a valid email address.')).toBeVisible()
    expect(screen.getByText('Enter your password.')).toBeVisible()
    await user.type(screen.getByLabelText('Work email'), 'demo@example.com')
    await user.type(screen.getByLabelText('Password', { exact: true }), 'demo-password')
    await user.click(screen.getByRole('button', { name: 'Show password' }))
    expect(screen.getByLabelText('Password', { exact: true })).toHaveAttribute('type', 'text')
    await user.click(screen.getByRole('button', { name: 'Preview login' }))
    expect(await screen.findByRole('status')).toHaveTextContent('No authentication')
    expect(screen.getByLabelText('Password', { exact: true })).toHaveValue('')
  })
  it('filters projects and creates a project with a validated dialog', async () => {
    const user = userEvent.setup()
    renderDemo(<ProjectsPage />)
    await user.type(screen.getByRole('searchbox', { name: 'Search projects' }), 'Orbit')
    expect(screen.getByRole('link', { name: /Orbit platform redesign/ })).toBeVisible()
    expect(screen.queryByRole('link', { name: /Bloom autumn/ })).not.toBeInTheDocument()
    await user.clear(screen.getByRole('searchbox', { name: 'Search projects' }))
    await user.click(screen.getByRole('button', { name: 'New project' }))
    const dialog = screen.getByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Create project' }))
    expect(await within(dialog).findByText('Use at least 3 characters.')).toBeVisible()
    await user.type(within(dialog).getByLabelText('Project name'), 'New demo campaign')
    await user.click(within(dialog).getByRole('button', { name: 'Create project' }))
    expect(await screen.findByRole('link', { name: /New demo campaign/ })).toBeVisible()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
  it('creates a task in memory and closes the form', async () => {
    const user = userEvent.setup()
    let closed = false
    renderDemo(
      <TaskForm
        onClose={() => {
          closed = true
        }}
      />,
    )
    await user.type(screen.getByLabelText('Task title'), 'Plan a launch review')
    await user.click(screen.getByRole('button', { name: 'Create task' }))
    expect(closed).toBe(true)
  })
  it('changes Kanban status using its keyboard-accessible menu', async () => {
    const user = userEvent.setup()
    renderDemo(<TasksPage />)
    await user.click(screen.getByRole('button', { name: 'Board' }))
    const control = screen.getByRole('combobox', {
      name: 'Status for Design the onboarding experience',
    })
    await user.selectOptions(control, 'done')
    expect(
      within(screen.getByRole('region', { name: 'Done' })).getByRole('link', {
        name: 'Design the onboarding experience',
      }),
    ).toBeVisible()
  })
  it('marks notifications read without a server', async () => {
    const user = userEvent.setup()
    renderDemo(<NotificationsPage />)
    expect(screen.getByText('2 unread')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Mark all as read' }))
    expect(screen.getByText('0 unread')).toBeInTheDocument()
  })
  it('renders the main shell, opens command search and persists the selected theme', async () => {
    const user = userEvent.setup()
    render(
      <Providers>
        <MemoryRouter initialEntries={['/w/studio/dashboard']}>
          <Routes>
            <Route path="/w/:workspaceId" element={<AppShell />}>
              <Route path="dashboard" element={<DashboardPage />} />
            </Route>
          </Routes>
        </MemoryRouter>
      </Providers>,
    )
    expect(screen.getByRole('heading', { name: 'Good morning, Jordan' })).toBeVisible()
    expect(screen.getByRole('navigation', { name: 'Workspace navigation' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Change theme' }))
    await user.click(screen.getByRole('menuitem', { name: 'Light theme' }))
    await waitFor(() => expect(document.documentElement).not.toHaveClass('dark'))
    expect(localStorage.getItem('flowwork-ui')).toContain('light')
    await user.click(screen.getByRole('button', { name: 'Search workspace' }))
    expect(screen.getByRole('dialog', { name: 'Find your next step' })).toBeVisible()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
  it('omits internal ticket notes in the client presentation', () => {
    renderDemo(
      <TicketDetailPage portal />,
      '/w/studio/portal/tickets/ticket-1',
      '/w/:workspaceId/portal/tickets/:ticketId',
    )
    expect(screen.getByText(/Could we take another look/)).toBeVisible()
    expect(screen.queryByText(/Internal review: include this/)).not.toBeInTheDocument()
    expect(screen.queryByRole('combobox', { name: 'Reply visibility' })).not.toBeInTheDocument()
  })
})
