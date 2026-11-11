import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router'
import { Providers } from '@/app/providers'
import { api, ApiClientError, type AuthUser } from '@/services/api-client'
import AuthPage from '@/features/auth/auth-page'
import ProtectedRoute from '@/features/auth/protected-route'
import AccountPage from '@/features/auth/account-page'
import VerificationPage from '@/features/auth/verification-page'

const user: AuthUser = {
  id: 'test-identity',
  name: 'Real Test Identity',
  email: 'identity@example.com',
  avatarUrl: null,
  emailVerified: true,
  accountStatus: 'active',
}
afterEach(() => vi.restoreAllMocks())
function renderAuth(path: string) {
  return render(
    <Providers>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/login" element={<AuthPage mode="login" />} />
          <Route path="/signup" element={<AuthPage mode="signup" />} />
          <Route path="/verify-email" element={<VerificationPage />} />
          <Route path="/reset-password" element={<AuthPage mode="reset" />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/account" element={<AccountPage />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </Providers>,
  )
}
describe('real identity UI and guarded session lifecycle', () => {
  it('submits signup and shows the truthful captured-verification state', async () => {
    const register = vi
      .spyOn(api, 'register')
      .mockResolvedValue({ deliveryMode: 'development-capture' })
    renderAuth('/signup')
    const interaction = userEvent.setup()
    await interaction.type(screen.getByLabelText('Full name'), user.name)
    await interaction.type(screen.getByLabelText('Work email'), user.email)
    await interaction.type(
      screen.getByLabelText('Password', { exact: true }),
      'A safe test passphrase 321!',
    )
    await interaction.click(screen.getByRole('button', { name: 'Create account' }))
    expect(register).toHaveBeenCalledTimes(1)
    expect(await screen.findByRole('status')).toHaveTextContent('No email delivery is claimed')
    expect(screen.getByLabelText('Password', { exact: true })).toHaveValue('')
  })
  it('logs in through the API and displays identity without granting a workspace', async () => {
    vi.spyOn(api, 'login').mockResolvedValue({ user })
    vi.spyOn(api, 'currentUser').mockResolvedValue(user)
    renderAuth('/login')
    const interaction = userEvent.setup()
    await interaction.type(screen.getByLabelText('Work email'), user.email)
    await interaction.type(
      screen.getByLabelText('Password', { exact: true }),
      'A safe test passphrase 321!',
    )
    await interaction.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(await screen.findByRole('heading', { name: `Welcome, ${user.name}.` })).toBeVisible()
    expect(screen.getByText(/no workspace or subscription has been created/)).toBeVisible()
    expect(screen.getByRole('link', { name: 'Explore Demo Workspace' })).toHaveAttribute(
      'href',
      '/w/studio/dashboard',
    )
  })
  it('keeps private content hidden while restoring the session', async () => {
    let resolve!: (value: AuthUser) => void
    vi.spyOn(api, 'currentUser').mockImplementation(
      () =>
        new Promise((done) => {
          resolve = done
        }),
    )
    renderAuth('/account')
    expect(screen.getByText('Checking your session…')).toBeVisible()
    expect(screen.queryByText(user.email)).not.toBeInTheDocument()
    resolve(user)
    expect(await screen.findByText(user.email)).toBeVisible()
  })
  it('redirects unauthenticated account access to login', async () => {
    vi.spyOn(api, 'currentUser').mockRejectedValue(
      new ApiClientError(401, 'UNAUTHENTICATED', 'Sign in again.'),
    )
    renderAuth('/account')
    expect(await screen.findByRole('heading', { name: 'Welcome back.' })).toBeVisible()
    expect(screen.queryByText(user.email)).not.toBeInTheDocument()
  })
  it('shows a retry state on network failure without revealing cached private content', async () => {
    vi.spyOn(api, 'currentUser').mockRejectedValue(
      new ApiClientError(0, 'NETWORK_ERROR', 'Cannot reach the server.'),
    )
    renderAuth('/account')
    expect(await screen.findByRole('heading', { name: 'Cannot check your session' })).toBeVisible()
    expect(screen.queryByText(user.email)).not.toBeInTheDocument()
  })
  it('confirms server logout, clears identity and returns to login', async () => {
    vi.spyOn(api, 'currentUser').mockResolvedValue(user)
    const logout = vi.spyOn(api, 'logout').mockResolvedValue()
    renderAuth('/account')
    await screen.findByText(user.email)
    await userEvent.setup().click(screen.getByRole('button', { name: 'Sign out' }))
    expect(await screen.findByRole('heading', { name: 'Welcome back.' })).toBeVisible()
    expect(logout).toHaveBeenCalledWith(false)
    expect(screen.queryByText(user.email)).not.toBeInTheDocument()
  })
  it('consumes an email fragment only after explicit confirmation', async () => {
    const verify = vi.spyOn(api, 'verify').mockResolvedValue({})
    renderAuth('/verify-email#token=controlled-test-token')
    expect(verify).not.toHaveBeenCalled()
    await userEvent.setup().click(screen.getByRole('button', { name: 'Verify email' }))
    await waitFor(() => expect(verify).toHaveBeenCalledWith('controlled-test-token'))
    expect(await screen.findByRole('status')).toHaveTextContent('Email verified')
  })
})
