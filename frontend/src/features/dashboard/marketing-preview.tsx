import {
  FolderKanban,
  CheckSquare2,
  LifeBuoy,
  Sparkles,
  ArrowUpRight,
  LayoutDashboard,
  Users,
} from 'lucide-react'
import { useDemo } from '@/hooks/use-demo'
import { progress } from '@/lib/utils'
import { Badge, Progress, Avatar } from '@/components/ui/display'

export default function MarketingPreview() {
  const { projects, tasks } = useDemo()
  return (
    <div
      className="product-preview"
      aria-label="Original product interface preview using fictional data"
    >
      <aside>
        <span className="preview-workspace">
          N<span>Northstar Studio</span>
        </span>
        {[
          { label: 'Dashboard', Icon: LayoutDashboard },
          { label: 'My Tasks', Icon: CheckSquare2 },
          { label: 'Projects', Icon: FolderKanban },
          { label: 'Team', Icon: Users },
          { label: 'Support', Icon: LifeBuoy },
          { label: 'FlowAI', Icon: Sparkles },
        ].map(({ label, Icon }, i) => (
          <span className={i === 0 ? 'active' : ''} key={label}>
            <Icon size={14} />
            {label}
          </span>
        ))}
        <small>Fictional demo data</small>
      </aside>
      <div className="preview-content">
        <header>
          <span>Workspace / Overview</span>
          <Badge tone="violet">Interactive preview</Badge>
        </header>
        <div className="preview-heading">
          <div>
            <small>YOUR WORK, IN PERSPECTIVE</small>
            <h3>
              Good morning, Jordan <span>↗</span>
            </h3>
            <p>A little clarity. A lot of possibility.</p>
          </div>
          <span className="preview-create">+ Create task</span>
        </div>
        <div className="preview-kpis">
          <div>
            <span>Active projects</span>
            <strong>
              {projects.filter((p) => p.status === 'active').length}
              <FolderKanban size={16} />
            </strong>
          </div>
          <div>
            <span>Pending tasks</span>
            <strong>
              {tasks.filter((t) => t.status !== 'done').length}
              <CheckSquare2 size={16} />
            </strong>
          </div>
          <div>
            <span>Currently complete</span>
            <strong>
              {progress(tasks)}%<Sparkles size={16} />
            </strong>
          </div>
        </div>
        <div className="preview-bottom">
          <section>
            <div className="row-between">
              <h4>Projects in motion</h4>
              <ArrowUpRight size={13} />
            </div>
            {projects.slice(0, 3).map((p) => (
              <div className="preview-project" key={p.id}>
                <span className={`preview-project-mark avatar-${p.color}`}>
                  <FolderKanban size={15} />
                </span>
                <div>
                  <strong>{p.name}</strong>
                  <Progress value={progress(tasks.filter((t) => t.projectId === p.id))} />
                </div>
                <small>{progress(tasks.filter((t) => t.projectId === p.id))}%</small>
              </div>
            ))}
          </section>
          <section className="preview-insight">
            <Sparkles size={20} />
            <h4>A shared direction.</h4>
            <p>
              Keep the context close.
              <br />
              Give good work room to grow.
            </p>
            <div className="avatar-group">
              <Avatar name="Maya Chen" size="small" color="rose" />
              <Avatar name="Alex Morgan" size="small" color="cyan" />
              <Avatar name="Sam Rivera" size="small" color="amber" />
            </div>
            <small>Sample workspace</small>
          </section>
        </div>
      </div>
    </div>
  )
}
