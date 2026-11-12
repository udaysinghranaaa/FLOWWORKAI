import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { Brand } from '@/components/layout/app-shell'
import { Badge, Card } from '@/components/ui/display'
import { Button } from '@/components/ui/button'
import { useSession, useSignOut } from './use-session'
import { useQuery } from '@tanstack/react-query'
import { tenantApi } from '@/services/tenant-api'

export default function AccountPage() {
  const { data: user } = useSession()
  const workspaces = useQuery({
    queryKey: ['tenant', user?.id, 'account-workspaces'],
    queryFn: () => tenantApi.workspaces(),
    enabled: !!user,
    retry: false,
  })
  const signOut = useSignOut(),
    navigate = useNavigate()
  const [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false)
  async function logout(all: boolean) {
    setBusy(true)
    setNotice('')
    try {
      await signOut(all)
      navigate('/login', { replace: true })
    } catch {
      setNotice('Could not confirm sign out. Check your connection and try again.')
    } finally {
      setBusy(false)
    }
  }
  if (!user) return null
  return (
    <main className="onboarding-page">
      <Brand />
      <Card>
        <Badge tone="green">REAL AUTHENTICATED ACCOUNT</Badge>
        <h1>Welcome, {user.name}.</h1>
        <p>{user.email}</p>
        <p className="muted">Email verified · {user.accountStatus} account</p>
        <h2>Your company, connected.</h2>
        <Button asChild>
          <Link to="/portal">Your client portals</Link>
        </Button>
        {workspaces.isPending ? (
          <p role="status">Loading your workspaces…</p>
        ) : workspaces.isError ? (
          <p role="alert">
            Could not load your workspaces.{' '}
            <Button
              onClick={() => {
                void workspaces.refetch()
              }}
            >
              Retry
            </Button>
          </p>
        ) : workspaces.data.items.length ? (
          <div className="tenant-actions">
            {workspaces.data.items.map((workspace) => (
              <Button key={workspace.id} asChild variant="primary">
                <Link to={`/app/w/${workspace.id}/overview`}>
                  {workspace.organizationName} · {workspace.name}
                </Link>
              </Button>
            ))}
            <Link to="/app/workspaces">All workspaces</Link>
          </div>
        ) : (
          <>
            <p className="muted">
              Your account is ready; no workspace or subscription has been created automatically.
              Set up your company or accept a private team invitation.
            </p>
            <Button asChild variant="primary">
              <Link to="/app/onboarding">Create your company</Link>
            </Button>
          </>
        )}
        <Button asChild variant="primary">
          <Link to="/w/studio/dashboard">Explore Demo Workspace</Link>
        </Button>
        <p className="muted">
          The demo uses fictional identities and in-memory records. It does not authorize backend
          access.
        </p>
        <Button
          disabled={busy}
          onClick={() => {
            void logout(false)
          }}
        >
          Sign out
        </Button>
        <Button
          disabled={busy}
          onClick={() => {
            void logout(true)
          }}
        >
          Sign out all devices
        </Button>
        {notice && <p role="alert">{notice}</p>}
      </Card>
      <Link to="/">Back to website</Link>
    </main>
  )
}
