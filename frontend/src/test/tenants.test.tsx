import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import TenantShell from '@/features/workspaces/tenant-shell'
import { Providers } from '@/app/providers'
import { api } from '@/services/api-client'
import { tenantApi } from '@/services/tenant-api'
import CompanyOnboarding from '@/features/onboarding/company-onboarding'
import WorkspaceList from '@/features/workspaces/workspace-list'
import { TeamDirectory } from '@/features/team/tenant-team'
const user = {
  id: 'controlled-identity',
  name: 'Controlled Person',
  email: 'controlled@example.com',
  emailVerified: true,
  accountStatus: 'active' as const,
  avatarUrl: null,
}
beforeEach(() => {
  vi.spyOn(api, 'currentUser').mockResolvedValue(user)
  vi.spyOn(tenantApi, 'organizations').mockResolvedValue({
    items: [],
    nextCursor: null,
    hasMore: false,
  })
})
afterEach(() => vi.restoreAllMocks())
function view(element: React.ReactNode) {
  return render(
    <Providers>
      <MemoryRouter>{element}</MemoryRouter>
    </Providers>,
  )
}
async function review() {
  const interaction = userEvent.setup()
  await interaction.type(screen.getByLabelText('Company name'), 'Hans Solar')
  await interaction.type(screen.getByLabelText('Company slug'), 'hans-solar')
  await interaction.click(screen.getByRole('button', { name: 'Continue' }))
  await interaction.click(screen.getByRole('button', { name: 'Continue' }))
  return interaction
}
describe('real tenant UI', () => {
  it('validates company details before advancing', async () => {
    view(<CompanyOnboarding />)
    await userEvent.setup().click(screen.getByRole('button', { name: 'Continue' }))
    expect(screen.getByLabelText('Company name')).toBeVisible()
    expect(screen.queryByRole('heading', { name: 'Review your company' })).not.toBeInTheDocument()
  })
  it('announces creation only after confirmed API success and keeps a UUID retry key', async () => {
    const create = vi.spyOn(tenantApi, 'createCompany').mockResolvedValue({
      organization: { id: 'org', name: 'Hans Solar' },
      workspace: { id: 'workspace' },
    } as Awaited<ReturnType<typeof tenantApi.createCompany>>)
    view(<CompanyOnboarding />)
    const interaction = await review()
    expect(create).not.toHaveBeenCalled()
    await interaction.click(screen.getByRole('button', { name: 'Create company' }))
    expect(await screen.findByRole('heading', { name: 'Your company is ready.' })).toBeVisible()
    expect(screen.getByRole('link', { name: 'Enter workspace' })).toHaveAttribute(
      'href',
      '/app/w/workspace/overview',
    )
    expect(create.mock.calls[0]![0].creationKey).toMatch(/^[a-f0-9-]{36}$/)
  })
  it('keeps submitted details and the same creation key when a network retry is needed', async () => {
    const create = vi
      .spyOn(tenantApi, 'createCompany')
      .mockRejectedValue(new Error('Connection unavailable'))
    view(<CompanyOnboarding />)
    const interaction = await review()
    await interaction.click(screen.getByRole('button', { name: 'Create company' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Connection unavailable')
    expect(
      screen.queryByRole('heading', { name: 'Your company is ready.' }),
    ).not.toBeInTheDocument()
    await interaction.click(screen.getByRole('button', { name: 'Create company' }))
    expect(create.mock.calls[0]![0].creationKey).toBe(create.mock.calls[1]![0].creationKey)
  })
  it('shows real empty memberships without fictional project metrics', async () => {
    vi.spyOn(tenantApi, 'workspaces').mockResolvedValue({
      items: [],
      nextCursor: null,
      hasMore: false,
    })
    view(<WorkspaceList />)
    expect(await screen.findByRole('heading', { name: 'No workspaces yet' })).toBeVisible()
    expect(screen.getByRole('link', { name: 'Create company' })).toHaveAttribute(
      'href',
      '/app/onboarding',
    )
  })
  it('announces backend denial without showing a previous workspace identity', async () => {
    vi.spyOn(tenantApi, 'workspaces').mockRejectedValue(new Error('This resource is unavailable.'))
    view(<WorkspaceList />)
    expect(await screen.findByText('This resource is unavailable.')).toBeVisible()
    expect(screen.queryByText('Hans Solar')).not.toBeInTheDocument()
  })
  it('hides invitation and mutation actions for viewers and displays database member records', async () => {
    vi.spyOn(tenantApi, 'members').mockResolvedValue({
      items: [
        {
          id: 'membership',
          userId: 'another',
          name: 'Database Member',
          email: 'member@example.com',
          role: 'MEMBER',
          status: 'active',
          joinedAt: new Date().toISOString(),
        },
      ],
      nextCursor: null,
      hasMore: false,
    })
    view(
      <TeamDirectory
        scope="workspaces"
        organizationId="org"
        workspaceId="workspace"
        permissions={['workspace.read', 'workspace.members.read']}
        role="VIEWER"
      />,
    )
    expect(await screen.findByText('Database Member')).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Invite member' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Remove' })).not.toBeInTheDocument()
  })
  it('does not flash cached workspace content while a fresh membership check is pending or denied', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    client.setQueryData(['auth', 'me'], user)
    client.setQueryData(['tenant', user.id, 'workspace', 'cached-workspace'], {
      organization: { name: 'Cached Private Company' },
      workspace: { name: 'Cached Private Workspace' },
      permissions: [],
      role: 'MEMBER',
    })
    vi.spyOn(tenantApi, 'workspaces').mockResolvedValue({
      items: [],
      nextCursor: null,
      hasMore: false,
    })
    let reject!: (error: Error) => void
    vi.spyOn(tenantApi, 'workspace').mockImplementation(
      () =>
        new Promise((_resolve, fail) => {
          reject = fail
        }),
    )
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={['/app/w/cached-workspace/overview']}>
          <Routes>
            <Route path="/app/w/:workspaceId" element={<TenantShell />}>
              <Route path="overview" element={<p>Cached private child</p>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    )
    expect(screen.getByText(/Verifying workspace access/)).toBeVisible()
    expect(screen.queryByText('Cached private child')).not.toBeInTheDocument()
    expect(screen.queryByText('Cached Private Company')).not.toBeInTheDocument()
    reject(new Error('This resource is unavailable.'))
    expect(await screen.findByText('This resource is unavailable.')).toBeVisible()
    expect(screen.queryByText('Cached private child')).not.toBeInTheDocument()
    client.clear()
  })
})
