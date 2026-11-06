import { useState } from 'react'
import { Link, NavLink, useParams } from 'react-router'
import { Pencil, CalendarDays, Flag, CheckCircle2, ArrowRight } from 'lucide-react'
import { toast } from 'sonner'
import { useDemo } from '@/hooks/use-demo'
import { formatDate, progress } from '@/lib/utils'
import { PageHeader, EmptyState, SectionHeading } from '@/components/shared/page'
import { Avatar, Badge, Card, Progress, StatusIndicator } from '@/components/ui/display'
import { Button } from '@/components/ui/button'
import ProjectForm from './project-form'
import TasksPage from '@/features/tasks/tasks-page'
import Kanban from '@/features/tasks/kanban'
import { useUIStore } from '@/stores/ui-store'

export default function ProjectDetailPage() {
  const { projectId, section } = useParams()
  const { projects, tasks, members, state, workspaceId, base } = useDemo()
  const [editing, setEditing] = useState(false)
  const setCreateTask = useUIStore((s) => s.setTaskCreateOpen)
  const project = projects.find((p) => p.id === projectId)
  if (!project)
    return (
      <EmptyState
        title="Project not found"
        description="Choose a project from this demo workspace."
        action={
          <Button asChild>
            <Link to={`${base}/projects`}>Back to projects</Link>
          </Button>
        }
      />
    )
  const projectTasks = tasks.filter((t) => t.projectId === project.id)
  const milestones = state.milestones.filter(
    (m) => m.projectId === project.id && m.workspaceId === workspaceId,
  )
  const tab = section ?? 'overview'
  const tabs = [
    { value: 'overview', label: 'Overview' },
    { value: 'tasks', label: 'Task list' },
    { value: 'board', label: 'Board' },
    { value: 'milestones', label: 'Milestones' },
    { value: 'activity', label: 'Activity' },
  ]
  return (
    <>
      <Link to={`${base}/projects`} className="back-link">
        ← All projects
      </Link>
      <PageHeader
        eyebrow="PROJECT WORKSPACE"
        title={project.name}
        description={project.description}
        action={
          <>
            <StatusIndicator status={project.status} />
            <Button onClick={() => setEditing(true)}>
              <Pencil size={15} />
              Edit project
            </Button>
          </>
        }
      />
      <nav className="tabs route-tabs" aria-label="Project sections">
        {tabs.map((t) => (
          <NavLink
            className={`tab ${tab === t.value ? 'selected' : ''}`}
            key={t.value}
            to={`${base}/projects/${project.id}/${t.value}`}
          >
            {t.label}
          </NavLink>
        ))}
      </nav>
      {tab === 'overview' ? (
        <div className="detail-grid">
          <div>
            <Card>
              <SectionHeading
                title="A clear path to delivery"
                subtitle="Task-based completion · demo data"
              />
              <div className="large-progress">
                <strong>
                  {progress(projectTasks)}
                  <span>%</span>
                </strong>
                <div>
                  <p>
                    {projectTasks.filter((t) => t.status === 'done').length} of{' '}
                    {projectTasks.length} tasks complete
                  </p>
                  <Progress value={progress(projectTasks)} />
                </div>
              </div>
              <div className="stat-row">
                <span>
                  <CalendarDays size={16} />
                  Due {formatDate(project.dueAt)} · UTC
                </span>
                <Badge tone={project.clientVisible ? 'green' : 'neutral'}>
                  {project.clientVisible ? 'Shared in client preview' : 'Internal project'}
                </Badge>
              </div>
            </Card>
            <Card>
              <SectionHeading
                title="Upcoming milestones"
                href={`${base}/projects/${project.id}/milestones`}
                linkLabel="View milestones"
              />
              {milestones.length ? (
                milestones.map((m) => (
                  <div className="milestone-row" key={m.id}>
                    <div className="milestone-icon">
                      {m.status === 'delivered' ? <CheckCircle2 size={18} /> : <Flag size={18} />}
                    </div>
                    <div>
                      <strong>{m.title}</strong>
                      <p className="muted text-sm">
                        {formatDate(m.dueAt)} · {m.deliverable}
                      </p>
                    </div>
                    <StatusIndicator status={m.status} />
                  </div>
                ))
              ) : (
                <EmptyState
                  title="No milestones yet"
                  description="Milestone editing will connect to the backend in a later phase."
                />
              )}
            </Card>
            <TasksPage projectId={project.id} embedded />
          </div>
          <aside>
            <Card>
              <SectionHeading title="Project team" />
              {project.memberIds
                .map((id) => members.find((m) => m.id === id))
                .filter((m) => !!m)
                .map((m) => (
                  <div className="person-row" key={m.id}>
                    <Avatar name={m.name} color={m.color} />
                    <div>
                      <strong>{m.name}</strong>
                      <p className="muted text-sm">{m.discipline}</p>
                    </div>
                  </div>
                ))}
            </Card>
            <div className="ai-card">
              <span className="eyebrow">KEEP THE CONTEXT CLOSE</span>
              <h3>One brief. A shared direction.</h3>
              <p>Explore the sample project brief and delivery playbook.</p>
              <Button asChild variant="ghost">
                <Link to={`${base}/knowledge`}>
                  Open knowledge base
                  <ArrowRight size={15} />
                </Link>
              </Button>
            </div>
          </aside>
        </div>
      ) : tab === 'tasks' ? (
        <TasksPage projectId={project.id} embedded />
      ) : tab === 'board' ? (
        <Kanban tasks={projectTasks} onCreate={() => setCreateTask(true)} />
      ) : tab === 'milestones' ? (
        <Card>
          <SectionHeading
            title="Milestones & deliverables"
            subtitle="Fictional delivery plan · no files are being transferred"
          />
          {milestones.length ? (
            milestones.map((m) => (
              <div className="milestone-row" key={m.id}>
                <Flag size={20} />
                <div>
                  <h3>{m.title}</h3>
                  <p className="muted">
                    {formatDate(m.dueAt)} · {m.deliverable}
                  </p>
                </div>
                <StatusIndicator status={m.status} />
                <Button
                  size="small"
                  onClick={() =>
                    toast.info(
                      'This is a sample deliverable. File download integration is unavailable.',
                    )
                  }
                >
                  Preview
                </Button>
              </div>
            ))
          ) : (
            <EmptyState
              title="No milestones yet"
              description="This demo project has no delivery checkpoints."
            />
          )}
        </Card>
      ) : tab === 'activity' ? (
        <Card>
          <SectionHeading title="Project activity" />
          {state.activities
            .filter((a) => a.workspaceId === workspaceId && a.target === project.name)
            .map((a) => (
              <div className="activity-row" key={a.id}>
                <Avatar name={a.actor} size="small" />
                <div>
                  <strong>{a.actor}</strong> {a.action}
                  <p className="muted">
                    {a.target} · {formatDate(a.createdAt)}
                  </p>
                </div>
              </div>
            ))}
        </Card>
      ) : (
        <EmptyState
          title="Section not found"
          action={
            <Button asChild>
              <Link to={`${base}/projects/${project.id}`}>Project overview</Link>
            </Button>
          }
        />
      )}
      {editing && <ProjectForm project={project} onClose={() => setEditing(false)} />}
    </>
  )
}
