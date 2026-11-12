import { RealMetrics } from '@/features/work-management/work-pages'
import { Link } from 'react-router'
import { Card, Badge } from '@/components/ui/display'
import { Button } from '@/components/ui/button'
import { TenantHeading } from './tenant-context'
import { useWorkspace } from './use-tenant'
import { useSession } from '@/features/auth/use-session'
export default function WorkspaceOverview() {
  const scope = useWorkspace(),
    { data: user } = useSession()
  return (
    <div className="tenant-page">
      <Badge tone="violet">{scope.organization.name}</Badge>
      <TenantHeading>{scope.workspace.name}</TenantHeading>
      <p className="muted">Welcome, {user?.name}. This is your real company workspace.</p>
      <div className="tenant-grid">
        <Card>
          <h2>Team members</h2>
          <strong className="tenant-number">{scope.memberCount}</strong>
          <p>Active workspace memberships</p>
        </Card>
        <Card>
          <h2>Your access</h2>
          <Badge>{scope.role}</Badge>
          <p>Company role: {scope.organizationRole}</p>
        </Card>
        {scope.pendingInvitations !== null && (
          <Card>
            <h2>Pending invitations</h2>
            <strong className="tenant-number">{scope.pendingInvitations}</strong>
            <p>Unexpired invitations for this workspace</p>
          </Card>
        )}
      </div>
      <RealMetrics />
      <Card>
        <h2>Explore the product preview</h2>
        <p className="muted">
          Projects and tasks above use your authorized workspace. Support, advanced analytics and AI
          remain future phases. The separate public demo uses fictional records.
        </p>
        <Button asChild>
          <Link to="/w/studio/projects">Explore a labeled demo preview</Link>
        </Button>
      </Card>
    </div>
  )
}
