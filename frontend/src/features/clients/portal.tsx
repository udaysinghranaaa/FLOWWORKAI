import { useState } from 'react'
import { Link, NavLink, Outlet, useParams } from 'react-router'
import {
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  Flag,
  LifeBuoy,
  Send,
  MessageSquare,
} from 'lucide-react'
import { toast } from 'sonner'
import { useDemo } from '@/hooks/use-demo'
import { Brand } from '@/components/layout/app-shell'
import { PageHeader, SectionHeading, EmptyState, IntegrationNotice } from '@/components/shared/page'
import { Avatar, Badge, Card, Progress, StatusIndicator } from '@/components/ui/display'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/fields'
import { formatDate, progress } from '@/lib/utils'

export function PortalLayout() {
  const { workspace, base } = useDemo()
  if (!workspace)
    return (
      <EmptyState
        title="Workspace not found"
        action={
          <Button asChild>
            <Link to="/workspaces">Choose workspace</Link>
          </Button>
        }
      />
    )
  return (
    <div className="portal-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <header className="portal-header">
        <Brand />
        <Badge tone="violet">Client preview</Badge>
        <div className="portal-header-right">
          <span className="muted">{workspace.name}</span>
          <Avatar name="Riley Park" color="green" size="small" />
          <Button size="small" asChild>
            <Link to={`${base}/dashboard`}>
              Staff demo
              <ArrowUpRight size={14} />
            </Link>
          </Button>
        </div>
      </header>
      <nav className="portal-nav" aria-label="Client portal navigation">
        <NavLink to={`${base}/portal/dashboard`}>Overview</NavLink>
        <NavLink to={`${base}/portal/projects`}>Your projects</NavLink>
        <NavLink to={`${base}/portal/tickets`}>Support</NavLink>
        <NavLink to={`${base}/portal/notifications`}>Updates</NavLink>
      </nav>
      <div className="portal-disclaimer">
        Client-facing presentation only. Fictional Orbit data · No authentication or server-side
        authorization · Changes reset on refresh.
      </div>
      <main id="main-content" className="portal-content">
        <Outlet />
      </main>
      <footer className="portal-footer">
        A shared space for clear progress. Powered by FlowWork AI.
      </footer>
    </div>
  )
}
export function PortalDashboard() {
  const { projects, tasks, state, workspaceId, tickets, base } = useDemo()
  const visible = projects.filter((p) => p.clientId === 'c-orbit' && p.clientVisible)
  const milestones = state.milestones.filter(
    (m) =>
      m.workspaceId === workspaceId && m.clientVisible && visible.some((p) => p.id === m.projectId),
  )
  return (
    <>
      <PageHeader
        eyebrow="YOUR PROJECTS, WITH A CLEARER VIEW"
        title="Welcome back, Riley"
        description="A little clarity on the work we’re making together."
        action={
          <Button asChild variant="primary">
            <Link to={`${base}/portal/tickets`}>
              <LifeBuoy size={16} />
              Contact your team
            </Link>
          </Button>
        }
      />
      <div className="metrics-grid portal-metrics">
        <Card className="metric-card">
          <span>Shared projects</span>
          <strong>{visible.length}</strong>
          <p>Approved for this client preview</p>
        </Card>
        <Card className="metric-card">
          <span>Delivered milestones</span>
          <strong>{milestones.filter((m) => m.status === 'delivered').length}</strong>
          <p>Of {milestones.length} shared milestones</p>
        </Card>
        <Card className="metric-card">
          <span>Open support requests</span>
          <strong>
            {
              tickets.filter(
                (t) => t.clientId === 'c-orbit' && !['resolved', 'closed'].includes(t.status),
              ).length
            }
          </strong>
          <p>Your client conversations</p>
        </Card>
      </div>
      <SectionHeading
        title="Work we’re making together"
        href={`${base}/portal/projects`}
        linkLabel="View projects"
      />
      <div className="project-grid">
        {visible.map((p) => (
          <Card key={p.id} className="project-card">
            <div className="row-between">
              <Badge tone="violet">Orbit</Badge>
              <StatusIndicator status={p.status} />
            </div>
            <h2>
              <Link to={`${base}/portal/projects/${p.id}`}>
                {p.name}
                <ArrowUpRight size={16} />
              </Link>
            </h2>
            <p className="muted">Your published delivery updates, milestones, and feedback.</p>
            <div className="progress-label">
              <span>Published tasks complete</span>
              <strong>
                {progress(tasks.filter((t) => t.projectId === p.id && t.clientVisible))}%
              </strong>
            </div>
            <Progress
              value={progress(tasks.filter((t) => t.projectId === p.id && t.clientVisible))}
            />
            <p className="muted text-sm">Project target: {formatDate(p.dueAt)} · UTC</p>
          </Card>
        ))}
      </div>
      {!visible.length && (
        <Card>
          <EmptyState
            title="No shared projects yet"
            description="This demo workspace has no published Orbit projects."
          />
        </Card>
      )}
      <Card>
        <SectionHeading title="Milestones on the horizon" />
        {milestones.map((m) => (
          <div className="milestone-row" key={m.id}>
            {m.status === 'delivered' ? <CheckCircle2 size={20} /> : <Flag size={20} />}
            <div>
              <strong>{m.title}</strong>
              <p className="muted">
                {formatDate(m.dueAt)} · {m.deliverable}
              </p>
            </div>
            <StatusIndicator status={m.status} />
          </div>
        ))}
        {!milestones.length && <p className="muted">No published milestones.</p>}
      </Card>
    </>
  )
}
export function PortalProjects() {
  const { projects, base } = useDemo()
  const visible = projects.filter((p) => p.clientId === 'c-orbit' && p.clientVisible)
  return (
    <>
      <PageHeader
        title="Your projects"
        description="A focused view of the projects shared with the fictional Orbit client."
      />
      <div className="project-grid">
        {visible.map((p) => (
          <Card key={p.id} className="project-card">
            <StatusIndicator status={p.status} />
            <h2>
              <Link to={`${base}/portal/projects/${p.id}`}>
                {p.name}
                <ArrowUpRight size={16} />
              </Link>
            </h2>
            <p className="muted">Target delivery: {formatDate(p.dueAt)}</p>
            <Button asChild>
              <Link to={`${base}/portal/projects/${p.id}`}>View progress</Link>
            </Button>
          </Card>
        ))}
      </div>
      {!visible.length && <EmptyState title="No shared projects yet" />}
    </>
  )
}
export function PortalProjectDetail() {
  const { projectId } = useParams()
  const { projects, tasks, state, workspaceId, repository, base } = useDemo()
  const [feedback, setFeedback] = useState('')
  const [selectedTask, setSelectedTask] = useState('')
  const project = projects.find(
    (p) => p.id === projectId && p.clientId === 'c-orbit' && p.clientVisible,
  )
  if (!project)
    return (
      <EmptyState
        title="Project not available in this preview"
        action={
          <Button asChild>
            <Link to={`${base}/portal/projects`}>Back to projects</Link>
          </Button>
        }
      />
    )
  const published = tasks.filter((t) => t.projectId === project.id && t.clientVisible)
  const comments = state.comments.filter(
    (c) =>
      c.workspaceId === workspaceId &&
      c.visibility === 'client' &&
      published.some((t) => t.id === c.taskId),
  )
  const milestones = state.milestones.filter(
    (m) => m.workspaceId === workspaceId && m.projectId === project.id && m.clientVisible,
  )
  return (
    <>
      <Link className="back-link" to={`${base}/portal/projects`}>
        ← Your projects
      </Link>
      <PageHeader
        title={project.name}
        description="Reviewed updates and delivery milestones. Internal task descriptions and notes are omitted."
        action={<StatusIndicator status={project.status} />}
      />
      <div className="two-column">
        <Card>
          <SectionHeading
            title="Published work"
            subtitle="Only tasks marked for the client-facing preview"
          />
          {published.map((t) => (
            <div className="published-task" key={t.id}>
              <div className="row-between">
                <h3>{t.title}</h3>
                <StatusIndicator status={t.status} />
              </div>
              <p className="muted">{t.publicSummary}</p>
              <small>
                <CalendarDays size={13} />
                {formatDate(t.dueAt)}
              </small>
            </div>
          ))}
        </Card>
        <Card>
          <SectionHeading title="Milestones & deliverables" />
          {milestones.map((m) => (
            <div className="milestone-row" key={m.id}>
              <Flag size={17} />
              <div>
                <strong>{m.title}</strong>
                <p className="muted text-sm">
                  {formatDate(m.dueAt)} · {m.deliverable}
                </p>
                <Button
                  size="small"
                  variant="ghost"
                  onClick={() =>
                    toast.info(
                      'This sample deliverable has no downloadable file. Storage integration is unavailable.',
                    )
                  }
                >
                  Deliverable preview
                  <ArrowUpRight size={13} />
                </Button>
              </div>
              <StatusIndicator status={m.status} />
            </div>
          ))}
        </Card>
      </div>
      <Card>
        <SectionHeading title="Feedback & conversation" action={<MessageSquare size={18} />} />
        {comments.map((c) => (
          <article className="comment" key={c.id}>
            <Avatar name={c.author} size="small" />
            <div>
              <strong>{c.author}</strong>
              <p>{c.body}</p>
            </div>
          </article>
        ))}
        <form
          className="form-stack"
          onSubmit={(e) => {
            e.preventDefault()
            const target = published.find((t) => t.id === selectedTask) ?? published[0]
            if (!target || !feedback.trim()) return
            repository.addComment({
              workspaceId,
              taskId: target.id,
              author: 'Riley Park · client demo',
              body: feedback.trim(),
              visibility: 'client',
            })
            setFeedback('')
            toast.success('Feedback added to the demo conversation')
          }}
        >
          <label htmlFor="feedback-task">Related published task</label>
          <select
            className="input"
            id="feedback-task"
            value={selectedTask || published[0]?.id || ''}
            onChange={(e) => setSelectedTask(e.target.value)}
          >
            {published.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </select>
          <label htmlFor="portal-feedback">Your feedback</label>
          <Textarea
            id="portal-feedback"
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            maxLength={2000}
            placeholder="Share a thought with your project team…"
          />
          <Button type="submit" variant="primary" disabled={!feedback.trim() || !published.length}>
            <Send size={15} />
            Post demo feedback
          </Button>
        </form>
      </Card>
      <IntegrationNotice>
        Client presentation filters are not a security boundary. Actual object-level authorization
        belongs in the future backend.
      </IntegrationNotice>
    </>
  )
}
