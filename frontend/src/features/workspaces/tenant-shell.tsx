import { Link, NavLink, Outlet, useNavigate, useParams } from 'react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Brand, ThemeMenu } from '@/components/layout/app-shell'
import { useSession } from '@/features/auth/use-session'
import { tenantApi } from '@/services/tenant-api'
import { Badge, LoadingState } from '@/components/ui/display'
import { Select } from '@/components/ui/fields'
import { TenantError } from './tenant-context'

export default function TenantShell() {
  const { workspaceId = '' } = useParams(),
    { data: user } = useSession(),
    navigate = useNavigate(),
    client = useQueryClient()
  const context = useQuery({
    queryKey: ['tenant', user?.id, 'workspace', workspaceId],
    queryFn: ({ signal }) => tenantApi.workspace(workspaceId, signal),
    retry: false,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchInterval: 10000,
  })
  const choices = useQuery({
    queryKey: ['tenant', user?.id, 'workspace-choices'],
    queryFn: () => tenantApi.workspaces(),
    retry: false,
  })
  if (context.isPending || (!context.isFetchedAfterMount && !context.isError))
    return <LoadingState label="Verifying workspace access…" />
  if (context.isError)
    return (
      <TenantError
        error={context.error}
        retry={() => {
          void context.refetch()
        }}
      />
    )
  const scope = context.data,
    base = `/app/w/${workspaceId}`
  return (
    <div className="tenant-layout">
      <a className="skip-link" href="#tenant-main">
        Skip to workspace
      </a>
      <header>
        <Brand />
        <Badge tone="green">AUTHENTICATED WORKSPACE</Badge>
        <ThemeMenu />
      </header>
      <div className="tenant-body">
        <aside>
          <label htmlFor="real-workspace-switch">Current workspace</label>
          <Select
            id="real-workspace-switch"
            value={workspaceId}
            onChange={async (event) => {
              const destination = event.target.value
              if (destination === workspaceId) return
              await client.cancelQueries({ queryKey: ['tenant', user?.id] })
              client.removeQueries({
                predicate: (query) =>
                  query.queryKey[0] === 'tenant' && query.queryKey.includes(workspaceId),
              })
              navigate(`/app/w/${destination}/overview`)
            }}
          >
            {!choices.data?.items.some((workspace) => workspace.id === workspaceId) && (
              <option value={workspaceId}>
                {scope.organization.name} · {scope.workspace.name}
              </option>
            )}
            {choices.data?.items.map((workspace) => (
              <option key={workspace.id} value={workspace.id}>
                {workspace.organizationName} · {workspace.name} · {workspace.role}
              </option>
            ))}
          </Select>
          <nav aria-label="Authenticated workspace navigation">
            <NavLink to={`${base}/overview`}>Overview</NavLink>
            <NavLink to={`${base}/team`}>Team</NavLink>
            <NavLink to={`${base}/settings`}>Workspace settings</NavLink>
            <Link to={`/app/organizations/${scope.organization.id}/settings`}>
              Company settings
            </Link>
            <Link to="/app/workspaces">All workspaces</Link>
            <Link to="/account">My account</Link>
            <Link to="/w/studio/dashboard">Explore Demo Workspace</Link>
          </nav>
          <p>{user?.name}</p>
          <small>{user?.email}</small>
          <Badge>{scope.role}</Badge>
        </aside>
        <main id="tenant-main" key={workspaceId}>
          <Outlet context={scope} />
        </main>
      </div>
    </div>
  )
}
