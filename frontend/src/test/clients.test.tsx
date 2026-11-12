import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route, Outlet } from 'react-router'
import { Providers } from '@/app/providers'
import { api, ApiClientError } from '@/services/api-client'
import { clientApi, type Client, type PortalDashboard } from '@/services/client-api'
import ClientsPage, { ClientDetail } from '@/features/client-management/client-pages'
import { ClientForm, Action } from '@/features/client-management/client-ui'
import { PortalHome, PortalOverview } from '@/features/client-management/portal-pages'
import { ProjectCollaboration } from '@/features/client-management/project-collaboration'
import {
  rememberPortalInvitation,
  pendingPortalInvitation,
  clearPortalInvitation,
} from '@/features/client-management/portal-continuation'
const identity = {
  id: 'controlled',
  name: 'Controlled',
  email: 'controlled@example.com',
  emailVerified: true,
  accountStatus: 'active',
  avatarUrl: null,
}
const empty = { items: [], hasMore: false, nextCursor: null }
const client: Client = {
  id: 'client-one',
  version: 1,
  name: 'Retail customer',
  legalName: '',
  type: '',
  industry: 'Retail',
  description: 'Shared work',
  website: '',
  email: '',
  phone: '',
  country: '',
  city: '',
  address: '',
  ownerId: 'controlled',
  status: 'active',
  tags: [],
  allowRepresentatives: false,
  archivedAt: null,
}
function view(element: React.ReactNode, path = '/real', route = '/real') {
  return render(
    <Providers>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route
            element={
              <Outlet
                context={{
                  workspace: { id: 'workspace-one' },
                  organization: { id: 'org-one' },
                  role: 'OWNER',
                }}
              />
            }
          >
            <Route path={route} element={element} />
          </Route>
        </Routes>
      </MemoryRouter>
    </Providers>,
  )
}
beforeEach(() => {
  vi.spyOn(api, 'currentUser').mockResolvedValue(identity)
  vi.spyOn(clientApi, 'list').mockResolvedValue(empty)
  vi.spyOn(clientApi, 'save').mockResolvedValue({})
})
afterEach(() => {
  vi.restoreAllMocks()
  clearPortalInvitation()
})
describe('Real client and portal UI', () => {
  it('renders client records from API and keeps fictional demo values absent', async () => {
    vi.mocked(clientApi.list).mockResolvedValue({ ...empty, items: [client] })
    view(<ClientsPage />)
    expect(await screen.findByRole('link', { name: client.name })).toHaveAttribute(
      'href',
      '/app/w/workspace-one/clients/client-one',
    )
    expect(screen.queryByText('Orbit')).not.toBeInTheDocument()
  })
  it('shows a useful empty client list', async () => {
    view(<ClientsPage />)
    expect(
      await screen.findByText('Your next client relationship starts here.'),
    ).toBeInTheDocument()
  })
  it('creates a client through the existing API boundary', async () => {
    view(<ClientsPage />)
    await userEvent.click(screen.getByRole('button', { name: 'Add client' }))
    await userEvent.type(screen.getByLabelText('Client name'), 'New customer')
    await userEvent.click(screen.getByRole('button', { name: 'Create client' }))
    await waitFor(() =>
      expect(clientApi.save).toHaveBeenCalledWith(
        '/workspaces/workspace-one/clients',
        expect.objectContaining({
          name: 'New customer',
          status: 'active',
          creationKey: expect.any(String),
        }),
      ),
    )
  })
  it('sends server-side search, status and sort filters', async () => {
    view(<ClientsPage />)
    await userEvent.type(screen.getByLabelText('Search clients'), 'Retail')
    await userEvent.selectOptions(screen.getByLabelText('Filter client status'), 'active')
    await userEvent.selectOptions(screen.getByLabelText('Sort clients'), 'newest')
    await waitFor(() =>
      expect(clientApi.list).toHaveBeenLastCalledWith(
        '/workspaces/workspace-one/clients',
        expect.objectContaining({ search: 'Retail', status: 'active', sort: 'newest' }),
        expect.any(AbortSignal),
      ),
    )
  })
  it('shows recoverable network errors without cached records', async () => {
    vi.mocked(clientApi.list).mockRejectedValue(new Error('Connection unavailable'))
    view(<ClientsPage />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Connection unavailable')
    vi.mocked(clientApi.list).mockResolvedValue(empty)
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(
      await screen.findByText('Your next client relationship starts here.'),
    ).toBeInTheDocument()
  })
  it('blocks invalid required fields with a visible message', async () => {
    const submit = vi.fn()
    view(<ClientForm fields={[{ name: 'name', label: 'Name', required: true }]} submit={submit} />)
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Complete this field')
    expect(submit).not.toHaveBeenCalled()
  })
  it('retains inputs and displays safe API conflicts', async () => {
    const submit = vi.fn().mockRejectedValue(new Error('Refresh before trying again'))
    view(<ClientForm fields={[{ name: 'name', label: 'Name' }]} submit={submit} />)
    await userEvent.type(screen.getByLabelText('Name'), 'Keep this')
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Refresh')
    expect(screen.getByLabelText('Name')).toHaveValue('Keep this')
  })
  it('requires explicit confirmation before access revocation', async () => {
    const run = vi.fn().mockResolvedValue({})
    view(
      <Action run={run} confirm="Access will be revoked.">
        Revoke
      </Action>,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Revoke' }))
    expect(run).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'Confirm' }))
    expect(run).toHaveBeenCalledTimes(1)
  })
  it('opens client profile contacts with invitation controls', async () => {
    vi.spyOn(clientApi, 'get').mockResolvedValue(client)
    vi.mocked(clientApi.list).mockImplementation(async (path) =>
      path.endsWith('/contacts')
        ? {
            ...empty,
            items: [
              {
                id: 'contact',
                version: 1,
                name: 'Customer Person',
                email: 'customer@example.com',
                title: '',
                phone: '',
                role: '',
                primary: true,
                archivedAt: null,
                portalAccess: false,
              },
            ],
          }
        : empty,
    )
    view(<ClientDetail />, '/clients/client-one', '/clients/:clientId')
    await screen.findByRole('heading', { name: client.name })
    await userEvent.click(screen.getByRole('button', { name: 'Contacts' }))
    expect(await screen.findByRole('heading', { name: 'Customer Person' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Invite to portal' }))
    await waitFor(() =>
      expect(clientApi.save).toHaveBeenCalledWith(
        '/workspaces/workspace-one/clients/client-one/invitations',
        { contactId: 'contact', role: 'CLIENT_MEMBER' },
      ),
    )
  })
  it('shows portal empty state without employee onboarding', async () => {
    view(<PortalHome />)
    expect(
      await screen.findByText('No client portal invitations accepted yet.'),
    ).toBeInTheDocument()
    expect(screen.queryByText('Create your company')).not.toBeInTheDocument()
  })
  it('renders real dashboard metrics and published updates', async () => {
    const dashboard = {
      client: { id: 'client-one', name: 'Retail customer', role: 'CLIENT_MEMBER' },
      sharedProjects: 2,
      pendingApprovals: 1,
      recentUpdates: [],
      milestones: [],
      recentFeedback: [],
    } satisfies PortalDashboard
    vi.spyOn(clientApi, 'get').mockResolvedValue(dashboard)
    view(<PortalOverview />, '/portal/client-one', '/portal/:clientId')
    expect(await screen.findByRole('heading', { name: 'Retail customer' })).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('No published updates yet.')).toBeInTheDocument()
  })
  it('conceals portal content on revoked access', async () => {
    vi.spyOn(clientApi, 'get').mockRejectedValue(
      new ApiClientError(404, 'NOT_FOUND', 'This resource is unavailable.'),
    )
    view(<PortalOverview />, '/portal/client-one', '/portal/:clientId')
    expect(await screen.findByRole('alert')).toHaveTextContent('unavailable')
    expect(screen.queryByText('Shared projects')).not.toBeInTheDocument()
  })
  it('hides creation controls from portal viewers', async () => {
    vi.spyOn(clientApi, 'get').mockResolvedValue({
      project: {
        title: 'Shared project',
        feedback: true,
        progress: true,
        changes: true,
        deliverables: true,
      },
      role: 'CLIENT_VIEWER',
    })
    view(<ProjectCollaboration clientId="client-one" projectId="project-one" />)
    await screen.findByRole('heading', { name: 'Shared project' })
    await userEvent.click(screen.getByRole('button', { name: 'Feedback' }))
    expect(screen.queryByRole('button', { name: 'Submit feedback' })).not.toBeInTheDocument()
  })
  it('submits project feedback without employee/task fields', async () => {
    vi.spyOn(clientApi, 'get').mockResolvedValue({
      project: { title: 'Shared project', feedback: true },
      role: 'CLIENT_MEMBER',
    })
    view(<ProjectCollaboration clientId="client-one" projectId="project-one" />)
    await userEvent.click(await screen.findByRole('button', { name: 'Submit feedback' }))
    await userEvent.type(screen.getByLabelText('Title'), 'Design feedback')
    await userEvent.type(screen.getByLabelText('Message'), 'Please refine spacing')
    await userEvent.click(screen.getByRole('button', { name: 'Send feedback' }))
    await waitFor(() =>
      expect(clientApi.save).toHaveBeenCalledWith(
        '/portal/clients/client-one/projects/project-one/resources',
        expect.objectContaining({
          kind: 'feedback',
          title: 'Design feedback',
          body: 'Please refine spacing',
          creationKey: expect.any(String),
        }),
      ),
    )
  })
  it('stores invitation continuation only in module memory and clears it explicitly', () => {
    rememberPortalInvitation('synthetic-test-continuation')
    expect(pendingPortalInvitation()).toBe('synthetic-test-continuation')
    expect(localStorage.getItem('portal-token')).toBeNull()
    clearPortalInvitation()
    expect(pendingPortalInvitation()).toBeUndefined()
  })
})
