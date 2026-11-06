import { Link } from 'react-router'
import {
  FolderKanban,
  CheckSquare2,
  Clock3,
  LifeBuoy,
  ArrowUpRight,
  Plus,
  Sparkles,
  ArrowRight,
  CalendarDays,
} from 'lucide-react'
import { useDemo } from '@/hooks/use-demo'
import { useUIStore } from '@/stores/ui-store'
import { formatDate, progress, isOverdue } from '@/lib/utils'
import { PageHeader, SectionHeading, EmptyState } from '@/components/shared/page'
import { Card, Badge, Avatar, Progress, StatusIndicator } from '@/components/ui/display'
import { Button } from '@/components/ui/button'
import { CompletionChart, StatusDistribution } from '@/components/charts/work-charts'

export default function DashboardPage() {
  const { projects, tasks, tickets, members, state, workspaceId, base } = useDemo()
  const create = useUIStore((s) => s.setTaskCreateOpen)
  const pending = tasks.filter((t) => t.status !== 'done')
  const overdue = tasks.filter(isOverdue)
  const openTickets = tickets.filter((t) => !['resolved', 'closed'].includes(t.status))
  const activities = state.activities.filter((a) => a.workspaceId === workspaceId)
  const metrics = [
    {
      label: 'Active projects',
      value: projects.filter((p) => p.status === 'active').length,
      note: `${projects.length} projects in the workspace`,
      icon: FolderKanban,
      color: 'violet',
      href: `${base}/projects`,
    },
    {
      label: 'Pending tasks',
      value: pending.length,
      note: `${tasks.filter((t) => t.status === 'done').length} completed so far`,
      icon: CheckSquare2,
      color: 'cyan',
      href: `${base}/tasks`,
    },
    {
      label: 'Overdue tasks',
      value: overdue.length,
      note: 'A little attention goes a long way',
      icon: Clock3,
      color: 'amber',
      href: `${base}/tasks`,
    },
    {
      label: 'Open tickets',
      value: openTickets.length,
      note: `${tickets.filter((t) => ['resolved', 'closed'].includes(t.status)).length} resolved or closed`,
      icon: LifeBuoy,
      color: 'green',
      href: `${base}/tickets`,
    },
  ]
  return (
    <>
      <PageHeader
        eyebrow="YOUR WORK, IN PERSPECTIVE"
        title="Good morning, Jordan"
        description="Here’s what’s happening across your studio. Let’s make it a good day."
        action={
          <>
            <Badge>
              <CalendarDays size={13} />
              Nov 6, 2026 · demo snapshot
            </Badge>
            <Button variant="primary" onClick={() => create(true)}>
              <Plus size={16} />
              Create task
            </Button>
          </>
        }
      />
      <div className="metrics-grid">
        {metrics.map(({ label, value, note, icon: Icon, color, href }) => (
          <Link to={href} className="card metric-card" key={label}>
            <div className="row-between">
              <span>{label}</span>
              <div className={`metric-icon avatar-${color}`}>
                <Icon size={17} />
              </div>
            </div>
            <strong>
              {value}
              <ArrowUpRight size={15} />
            </strong>
            <p>{note}</p>
          </Link>
        ))}
      </div>
      {!projects.length ? (
        <Card>
          <EmptyState
            title="Your next chapter starts here"
            description="This demo workspace is empty. Create a project, then add a few tasks."
            action={
              <Button asChild variant="primary">
                <Link to={`${base}/projects`}>Create your first project</Link>
              </Button>
            }
          />
        </Card>
      ) : (
        <>
          <div className="dashboard-main-grid">
            <Card className="completion-card">
              <SectionHeading
                title="A little progress, every day"
                subtitle="Current task status grouped by November due date · sample data"
                action={<Badge tone="violet">November 2026</Badge>}
              />
              <CompletionChart tasks={tasks} />
            </Card>
            <Card>
              <SectionHeading
                title="Task overview"
                subtitle={`${tasks.length} tasks · all demo assignments`}
              />
              <div className="task-total">
                <strong>{progress(tasks)}%</strong>
                <span>complete</span>
                <CheckSquare2 size={30} />
              </div>
              <StatusDistribution tasks={tasks} />
            </Card>
          </div>
          <div className="dashboard-main-grid">
            <Card className="recent-projects">
              <SectionHeading title="Projects in motion" href={`${base}/projects`} />
              {projects.slice(0, 3).map((p) => {
                const value = progress(tasks.filter((t) => t.projectId === p.id))
                return (
                  <Link className="project-row" key={p.id} to={`${base}/projects/${p.id}`}>
                    <div className={`project-icon avatar-${p.color}`}>
                      <FolderKanban size={18} />
                    </div>
                    <div className="project-row-name">
                      <strong>{p.name}</strong>
                      <span className="muted text-sm">Due {formatDate(p.dueAt)}</span>
                    </div>
                    <StatusIndicator status={p.status} />
                    <div className="project-row-progress">
                      <strong>{value}%</strong>
                      <Progress value={value} />
                    </div>
                    <ArrowUpRight size={16} className="muted" />
                  </Link>
                )
              })}
            </Card>
            <div className="ai-card dashboard-ai">
              <div className="ai-symbol">
                <Sparkles size={23} />
              </div>
              <Badge tone="violet">A LITTLE HELP FROM FLOWAI</Badge>
              <h2>
                Less searching.
                <br />
                More moving forward.
              </h2>
              <p>
                Explore a sample project summary, draft a client update, or find the context you
                need.
              </p>
              <Button asChild variant="primary">
                <Link to={`${base}/ai`}>
                  Explore FlowAI
                  <ArrowRight size={16} />
                </Link>
              </Button>
              <small>Sample conversations. No live AI connection.</small>
            </div>
          </div>
          <div className="dashboard-three-grid">
            <Card>
              <SectionHeading title="On the horizon" href={`${base}/tasks`} linkLabel="All tasks" />
              {pending
                .slice()
                .sort((a, b) => a.dueAt.localeCompare(b.dueAt))
                .slice(0, 4)
                .map((t) => (
                  <Link className="deadline-row" key={t.id} to={`${base}/tasks/${t.id}`}>
                    <div className={isOverdue(t) ? 'date-tile overdue' : 'date-tile'}>
                      <span>{formatDate(t.dueAt).split(' ')[0]}</span>
                      <strong>{formatDate(t.dueAt).split(' ')[1]}</strong>
                    </div>
                    <div>
                      <strong>{t.title}</strong>
                      <small className={isOverdue(t) ? 'danger-text' : 'muted'}>
                        {isOverdue(t) ? 'Overdue · ' : ''}
                        {projects.find((p) => p.id === t.projectId)?.name}
                      </small>
                    </div>
                  </Link>
                ))}
            </Card>
            <Card>
              <SectionHeading title="Around the studio" subtitle="Sample activity timeline" />
              {activities.slice(0, 4).map((a) => (
                <div className="activity-row" key={a.id}>
                  <Avatar
                    name={a.actor}
                    size="small"
                    color={members.find((m) => m.name === a.actor)?.color}
                  />
                  <div>
                    <p>
                      <strong>{a.actor.split(' ')[0]}</strong> {a.action} <span>{a.target}</span>
                    </p>
                    <time dateTime={a.createdAt}>{formatDate(a.createdAt)}</time>
                  </div>
                </div>
              ))}
            </Card>
            <Card>
              <SectionHeading
                title="People behind the work"
                href={`${base}/team`}
                linkLabel="Team"
              />
              {members
                .filter((m) => m.role !== 'Client')
                .map((m) => (
                  <div className="person-row" key={m.id}>
                    <Avatar name={m.name} color={m.color} />
                    <div>
                      <strong>{m.name}</strong>
                      <p className="muted text-sm">{m.discipline}</p>
                    </div>
                    <span className={`availability ${m.status}`} role="img" aria-label={m.status} />
                  </div>
                ))}
            </Card>
          </div>
          <Card className="support-strip">
            <div className="metric-icon avatar-cyan">
              <LifeBuoy size={20} />
            </div>
            <div>
              <h3>Keep the conversation going</h3>
              <p className="muted">
                {openTickets.length} support requests are waiting for their next step.
              </p>
            </div>
            <Button asChild>
              <Link to={`${base}/tickets`}>
                Open support inbox
                <ArrowUpRight size={15} />
              </Link>
            </Button>
          </Card>
        </>
      )}
    </>
  )
}
