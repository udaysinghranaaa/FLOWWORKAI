import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { useSession } from '@/features/auth/use-session'
import { useActionToken } from '@/features/auth/use-action-token'
import { tenantApi } from '@/services/tenant-api'
import { Brand, ThemeMenu } from '@/components/layout/app-shell'
import { Card, Badge, LoadingState } from '@/components/ui/display'
import { Button } from '@/components/ui/button'
import { TenantHeading } from '@/features/workspaces/tenant-context'
import { useTenantRefresh } from '@/features/workspaces/use-tenant'
import { pendingInvitation, rememberInvitation, clearInvitation } from './continuation'
export default function InvitationPage() {
  const fragment = useActionToken(),
    [token] = useState(() => fragment || pendingInvitation() || ''),
    [key] = useState(() => crypto.randomUUID()),
    [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false)
  const session = useSession(),
    refresh = useTenantRefresh(),
    navigate = useNavigate()
  useEffect(() => {
    if (token) rememberInvitation(token)
  }, [token])
  const preview = useQuery({
    queryKey: ['invitation-preview', key],
    queryFn: () => tenantApi.preview(token),
    enabled: !!token,
    retry: false,
    gcTime: 0,
  })
  return (
    <main className="tenant-onboarding">
      <header>
        <Brand />
        <ThemeMenu />
      </header>
      <Card>
        <Badge tone="violet">WORKSPACE INVITATION</Badge>
        <TenantHeading>Good work starts together.</TenantHeading>
        {!token ? (
          <p>
            Open your private invitation link. If you registered or verified in another tab, return
            to that original link after signing in.
          </p>
        ) : preview.isPending ? (
          <LoadingState label="Checking invitation…" />
        ) : preview.isError ? (
          <p role="alert">
            {preview.error instanceof Error ? preview.error.message : 'Invitation unavailable.'}
          </p>
        ) : (
          <>
            <h2>{preview.data.organizationName}</h2>
            <ul>
              {preview.data.workspaces.map((workspace) => (
                <li key={workspace.name}>
                  {workspace.name} · {workspace.role}
                </li>
              ))}
            </ul>
            <p className="muted">
              Company role: {preview.data.organizationRole} · Expires{' '}
              {new Date(preview.data.expiresAt).toLocaleString()}
            </p>
            {session.isPending ? (
              <LoadingState label="Checking your identity…" />
            ) : session.isError ? (
              <p role="alert">Could not check your identity. Retry by reopening your invitation.</p>
            ) : session.data ? (
              <>
                <p>Accepting as {session.data.email}. The address must match this invitation.</p>
                <Button
                  variant="primary"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true)
                    try {
                      const result = await tenantApi.accept(token)
                      clearInvitation()
                      await refresh()
                      navigate(`/app/w/${result.workspaceId}/overview`)
                    } catch (error) {
                      setNotice(
                        error instanceof Error
                          ? error.message
                          : 'Invitation could not be accepted.',
                      )
                    } finally {
                      setBusy(false)
                    }
                  }}
                >
                  Accept invitation
                </Button>
              </>
            ) : (
              <>
                <p>
                  Sign in with the invited address, or create and verify an account. Then return to
                  this invitation.
                </p>
                <div className="tenant-actions">
                  <Button asChild variant="primary">
                    <Link to="/login">Sign in to accept</Link>
                  </Button>
                  <Button asChild>
                    <Link to="/signup">Create an account</Link>
                  </Button>
                </div>
              </>
            )}
          </>
        )}
        {notice && <p role="alert">{notice}</p>}
        <Link to="/account">My account</Link>
      </Card>
    </main>
  )
}
