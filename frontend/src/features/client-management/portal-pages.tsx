import { useClientQuery } from './use-client'
import { Link, Outlet, useParams, useNavigate } from 'react-router'
import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Brand, ThemeMenu } from '@/components/layout/app-shell'
import { Card, Badge } from '@/components/ui/display'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/shared/page'
import { useSession, useSignOut } from '@/features/auth/use-session'
import { useActionToken } from '@/features/auth/use-action-token'
import {
  clientApi,
  portalPath,
  type PortalIdentity,
  type PortalDashboard,
  type Grant,
  type PortalMember,
} from '@/services/client-api'
import { ClientList, QueryState } from './client-ui'
import { ProjectCollaboration } from './project-collaboration'
import { MemberForm } from './client-pages'
import {
  rememberPortalInvitation,
  pendingPortalInvitation,
  clearPortalInvitation,
} from './portal-continuation'
export function PortalShell() {
  const { clientId } = useParams(),
    cache = useQueryClient(),
    signOut = useSignOut(),
    navigate = useNavigate(),
    [error, setError] = useState('')
  useEffect(
    () => () => {
      const oldPath = clientId ? `/portal/clients/${clientId}` : '/portal/clients'
      const predicate = (q: { queryKey: readonly unknown[] }) =>
        q.queryKey[0] === 'clients' &&
        typeof q.queryKey[2] === 'string' &&
        (clientId ? q.queryKey[2].startsWith(oldPath) : q.queryKey[2] === oldPath)
      void cache.cancelQueries({ predicate })
      cache.removeQueries({ predicate })
    },
    [clientId, cache],
  )
  return (
    <div className="portal-shell">
      <a className="skip-link" href="#portal-main">
        Skip to portal
      </a>
      <header className="portal-header">
        <Brand />
        <Badge tone="violet">CLIENT PORTAL</Badge>
        <ThemeMenu />
        <Button
          onClick={async () => {
            try {
              await signOut()
              navigate('/login')
            } catch {
              setError('Unable to sign out. Please retry.')
            }
          }}
        >
          Sign out
        </Button>
      </header>
      <nav className="portal-nav" aria-label="Client portal navigation">
        <Link to="/portal">Your client portals</Link>
        {clientId && <Link to={`/portal/${clientId}`}>Overview and projects</Link>}
        <Link to="/account">Profile</Link>
      </nav>
      {error && <p role="alert">{error}</p>}
      <main id="portal-main" className="portal-content" key={clientId ?? 'all'}>
        <Outlet />
      </main>
      <footer className="portal-footer">
        A shared space for clear progress. Powered by FlowWork AI.
      </footer>
    </div>
  )
}
export function PortalHome() {
  return (
    <>
      <PageHeader
        title="Your client portals"
        description="A private view of the work shared with you."
      />
      <ClientList<PortalIdentity>
        path="/portal/clients"
        empty="No client portal invitations accepted yet."
        render={(c) => (
          <Card>
            <Badge>{c.role.replaceAll('_', ' ')}</Badge>
            <h2>
              <Link to={`/portal/${c.id}`}>{c.name}</Link>
            </h2>
          </Card>
        )}
      />
      <p>
        If you received an invitation, open the original private link after signing in and verifying
        your email.
      </p>
    </>
  )
}
export function PortalOverview() {
  const { clientId = '' } = useParams(),
    path = portalPath(clientId),
    q = useClientQuery<PortalDashboard>(path)
  return (
    <QueryState
      pending={q.isPending || (!q.isFetchedAfterMount && !q.isError)}
      error={q.error}
      retry={() => {
        void q.refetch()
      }}
    >
      {q.data && (
        <>
          <PageHeader
            title={q.data.client.name}
            description="Progress you can see. Decisions you can move forward."
          />
          <div className="metrics-grid">
            <Card className="metric-card">
              <span>Shared projects</span>
              <strong>{q.data.sharedProjects}</strong>
            </Card>
            <Card className="metric-card">
              <span>Pending approvals</span>
              <strong>{q.data.pendingApprovals}</strong>
            </Card>
          </div>
          <h2>Your projects</h2>
          <ClientList<Grant>
            path={path + '/projects'}
            empty="No projects have been shared yet."
            render={(g) => (
              <Card>
                <h3>
                  <Link to={`/portal/${clientId}/projects/${g.projectId}`}>{g.title}</Link>
                </h3>
                <p>{g.description}</p>
              </Card>
            )}
          />
          <div className="client-columns">
            <Card>
              <h2>Latest published updates</h2>
              {q.data.recentUpdates.length ? (
                q.data.recentUpdates.map((r) => (
                  <section key={r.id}>
                    <h3>{r.title}</h3>
                    <p>{r.body}</p>
                    <p>{r.progress}% progress</p>
                  </section>
                ))
              ) : (
                <p>No published updates yet.</p>
              )}
            </Card>
            <Card>
              <h2>Upcoming milestones</h2>
              {q.data.milestones.length ? (
                q.data.milestones.map((r) => (
                  <section key={r.id}>
                    <h3>{r.title}</h3>
                    <p>
                      {r.dueDate} · {r.status.replaceAll('_', ' ')}
                    </p>
                  </section>
                ))
              ) : (
                <p>No upcoming published milestones.</p>
              )}
            </Card>
            <Card>
              <h2>Recent feedback</h2>
              {q.data.recentFeedback.length ? (
                q.data.recentFeedback.map((r) => (
                  <p key={r.id}>
                    {r.title} · {r.status}
                  </p>
                ))
              ) : (
                <p>No feedback yet.</p>
              )}
            </Card>
          </div>
          {q.data.client.role === 'CLIENT_ADMIN' && q.data.client.allowRepresentatives && (
            <details>
              <summary>Representatives</summary>
              <ClientList<PortalMember>
                path={path + '/members'}
                render={(m) => (
                  <Card>
                    <Badge>{m.role}</Badge>
                    <p>
                      {m.self ? 'You' : 'Client representative'} · {m.status}
                    </p>
                    {!m.self && m.role !== 'CLIENT_ADMIN' && (
                      <MemberForm external path={path + '/members/' + m.id} member={m} />
                    )}
                  </Card>
                )}
              />
              <p>Representative changes require explicit agency permission.</p>
            </details>
          )}
        </>
      )}
    </QueryState>
  )
}
export function PortalProjectPage() {
  const { clientId = '', projectId = '' } = useParams()
  return <ProjectCollaboration clientId={clientId} projectId={projectId} />
}
export function PortalInvitation() {
  const fragment = useActionToken(),
    [token] = useState(() => fragment || pendingPortalInvitation() || ''),
    [preview, setPreview] = useState<{ clientName: string; role: string } | null>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    session = useSession(),
    navigate = useNavigate(),
    cache = useQueryClient()
  useEffect(() => {
    if (!token) return
    rememberPortalInvitation(token)
    let active = true
    void clientApi
      .save<{ clientName: string; role: string }>('/portal/invitations/preview', { token })
      .then((r) => {
        if (active) setPreview(r)
      })
      .catch((e) => {
        if (active) setError(e instanceof Error ? e.message : 'Invitation unavailable.')
      })
    return () => {
      active = false
    }
  }, [token])
  return (
    <main className="tenant-onboarding">
      <Brand />
      <Card>
        <Badge>CLIENT PORTAL INVITATION</Badge>
        <h1>A clearer view of your project.</h1>
        {!token ? (
          <p>Open your original private invitation link.</p>
        ) : preview ? (
          <>
            <h2>{preview.clientName}</h2>
            <p>{preview.role.replaceAll('_', ' ')}</p>
            {session.data ? (
              <Button
                disabled={busy}
                variant="primary"
                onClick={async () => {
                  setBusy(true)
                  try {
                    const result = await clientApi.save<{ clientId: string }>(
                      '/portal/invitations/accept',
                      { token },
                    )
                    clearPortalInvitation()
                    await cache.invalidateQueries()
                    navigate(`/portal/${result.clientId}`)
                  } catch (e) {
                    setError(e instanceof Error ? e.message : 'Unable to accept invitation.')
                  } finally {
                    setBusy(false)
                  }
                }}
              >
                Accept client invitation
              </Button>
            ) : (
              <>
                <p>
                  Sign in with the invited, verified email. New here? Register and verify, then
                  reopen your original invitation.
                </p>
                <Link to="/login">Sign in</Link>
                <span> · </span>
                <Link to="/signup">Create account</Link>
              </>
            )}
          </>
        ) : (
          !error && <p role="status">Checking invitation…</p>
        )}
        {error && <p role="alert">{error}</p>}
      </Card>
    </main>
  )
}
