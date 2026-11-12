import { useState } from 'react'
import { Link } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { useSession } from '@/features/auth/use-session'
import { tenantApi } from '@/services/tenant-api'
import { Brand, ThemeMenu } from '@/components/layout/app-shell'
import { Badge, Card, LoadingState } from '@/components/ui/display'
import { Button } from '@/components/ui/button'
import { TenantError, TenantHeading } from './tenant-context'

export default function WorkspaceList() {
  const { data: user } = useSession(),
    [cursor, setCursor] = useState<string | null>(null),
    [companyCursor, setCompanyCursor] = useState<string | null>(null)
  const companies = useQuery({
    queryKey: ['tenant', user?.id, 'companies', companyCursor],
    queryFn: () => tenantApi.organizations(companyCursor),
    retry: false,
  })
  const query = useQuery({
    queryKey: ['tenant', user?.id, 'workspaces', cursor],
    queryFn: () => tenantApi.workspaces(cursor),
    retry: false,
  })
  return (
    <main className="tenant-directory">
      <header>
        <Brand />
        <ThemeMenu />
      </header>
      <TenantHeading>Your workspaces</TenantHeading>
      <p className="muted">Choose a company and workspace where you have current access.</p>
      <div className="tenant-actions">
        <Button asChild variant="primary">
          <Link to="/app/onboarding">Create company</Link>
        </Button>
        <Button asChild>
          <Link to="/account">Account</Link>
        </Button>
        <Button asChild>
          <Link to="/app/invitations">Invitation help</Link>
        </Button>
      </div>
      <section aria-label="Your companies">
        <h2>Your companies</h2>
        {companies.isPending ? (
          <p role="status">Loading companies…</p>
        ) : companies.isError ? (
          <p role="alert">
            Could not load companies.{' '}
            <Button
              onClick={() => {
                void companies.refetch()
              }}
            >
              Retry companies
            </Button>
          </p>
        ) : (
          <>
            <div className="tenant-actions">
              {companies.data.items.map((company) => (
                <Button key={company.id} asChild>
                  <Link to={`/app/organizations/${company.id}/settings`}>
                    {company.name} · {company.role} · {company.status}
                  </Link>
                </Button>
              ))}
            </div>
            {!companies.data.items.length && <p className="muted">No company memberships yet.</p>}
            {companyCursor && (
              <Button onClick={() => setCompanyCursor(null)}>First companies</Button>
            )}
            {companies.data.nextCursor && (
              <Button onClick={() => setCompanyCursor(companies.data.nextCursor)}>
                Next companies
              </Button>
            )}
          </>
        )}
      </section>
      {query.isPending ? (
        <LoadingState label="Checking workspace memberships…" />
      ) : query.isError ? (
        <TenantError
          error={query.error}
          retry={() => {
            void query.refetch()
          }}
        />
      ) : (
        <>
          <div className="tenant-grid">
            {query.data.items.map((workspace) => (
              <Card key={workspace.id}>
                <Badge>{workspace.role}</Badge>
                <h2>{workspace.name}</h2>
                <p>{workspace.organizationName}</p>
                <p className="muted">{workspace.status}</p>
                <Button asChild>
                  <Link to={`/app/w/${workspace.id}/overview`}>Open {workspace.name}</Link>
                </Button>
              </Card>
            ))}
          </div>
          {!query.data.items.length && (
            <Card>
              <h2>No workspaces yet</h2>
              <p>Create a company or open your invitation after verifying your email.</p>
            </Card>
          )}
          <div className="tenant-actions">
            {cursor && <Button onClick={() => setCursor(null)}>First page</Button>}
            {query.data.nextCursor && (
              <Button onClick={() => setCursor(query.data.nextCursor)}>Next workspaces</Button>
            )}
          </div>
        </>
      )}
    </main>
  )
}
