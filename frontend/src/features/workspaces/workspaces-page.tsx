import { Link } from 'react-router'
import { ArrowUpRight, Plus, Building2 } from 'lucide-react'
import { useDemo } from '@/hooks/use-demo'
import { Brand } from '@/components/layout/app-shell'
import { Card, Badge } from '@/components/ui/display'
import { Button } from '@/components/ui/button'
export default function WorkspacesPage() {
  const { state } = useDemo()
  return (
    <main className="workspace-picker">
      <Brand />
      <Badge tone="violet">Frontend demo · no secure session</Badge>
      <h1>
        A place for every
        <br />
        kind of good work.
      </h1>
      <p className="muted">
        Choose a fictional workspace. Edits stay in memory and reset on refresh.
      </p>
      <div className="workspace-options">
        {state.workspaces.map((w) => (
          <Link key={w.id} to={`/w/${w.id}/dashboard`}>
            <Card>
              <span className="workspace-initials">{w.initials}</span>
              <div>
                <h2>{w.name}</h2>
                <p>{w.description}</p>
              </div>
              <ArrowUpRight size={20} />
            </Card>
          </Link>
        ))}
      </div>
      <div className="row-between">
        <Button asChild>
          <Link to="/onboarding">
            <Plus size={15} />
            Onboarding preview
          </Link>
        </Button>
        <Link className="text-link" to="/">
          Back to website
          <Building2 size={15} />
        </Link>
      </div>
    </main>
  )
}
