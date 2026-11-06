import { useState } from 'react'
import { Link } from 'react-router'
import { Plus, LayoutGrid, List, CalendarDays, ArrowUpRight, FolderKanban } from 'lucide-react'
import { useDemo } from '@/hooks/use-demo'
import { progress, formatDate } from '@/lib/utils'
import { PageHeader, EmptyState } from '@/components/shared/page'
import { Button } from '@/components/ui/button'
import { SearchInput, Select } from '@/components/ui/fields'
import { Avatar, Progress, StatusIndicator, Table, Badge } from '@/components/ui/display'
import type { Project } from '@/types/domain'
import ProjectForm from './project-form'

export default function ProjectsPage() {
  const { projects, tasks, members, clients, base } = useDemo()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [sort, setSort] = useState('deadline')
  const [view, setView] = useState('grid')
  const [creating, setCreating] = useState(false)
  const filtered = projects
    .filter(
      (p) =>
        p.name.toLowerCase().includes(search.toLowerCase()) &&
        (status === 'all' || p.status === status),
    )
    .sort((a, b) =>
      sort === 'name' ? a.name.localeCompare(b.name) : a.dueAt.localeCompare(b.dueAt),
    )
  return (
    <>
      <PageHeader
        eyebrow="GOOD WORK, TAKING SHAPE"
        title="Projects"
        description="A shared view of what’s moving, what’s next, and what matters."
        action={
          <Button variant="primary" onClick={() => setCreating(true)}>
            <Plus size={16} />
            New project
          </Button>
        }
      />
      <div className="summary-pills">
        <Badge tone="violet">{projects.filter((p) => p.status === 'active').length} active</Badge>
        <Badge>{projects.filter((p) => p.status === 'planned').length} planned</Badge>
        <span className="muted text-sm">{projects.length} projects in this demo workspace</span>
      </div>
      <div className="filter-bar">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search projects…"
          label="Search projects"
        />
        <Select
          value={status}
          aria-label="Filter project status"
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="all">All statuses</option>
          {['active', 'planned', 'paused', 'completed', 'archived'].map((s) => (
            <option key={s} value={s}>
              {s[0].toUpperCase() + s.slice(1)}
            </option>
          ))}
        </Select>
        <Select value={sort} aria-label="Sort projects" onChange={(e) => setSort(e.target.value)}>
          <option value="deadline">Deadline: earliest first</option>
          <option value="name">Project name</option>
        </Select>
        <div className="view-switch">
          <Button
            size="small"
            aria-label="Grid view"
            aria-pressed={view === 'grid'}
            variant={view === 'grid' ? 'secondary' : 'ghost'}
            onClick={() => setView('grid')}
          >
            <LayoutGrid size={16} />
          </Button>
          <Button
            size="small"
            aria-label="Table view"
            aria-pressed={view === 'table'}
            variant={view === 'table' ? 'secondary' : 'ghost'}
            onClick={() => setView('table')}
          >
            <List size={16} />
          </Button>
        </div>
      </div>
      {!filtered.length ? (
        <EmptyState
          title={projects.length ? 'No projects match' : 'A fresh canvas for your next project'}
          description="Create a project to bring the team, tasks, and a clear outcome together."
          action={<Button onClick={() => setCreating(true)}>New project</Button>}
        />
      ) : view === 'grid' ? (
        <div className="project-grid">
          {filtered.map((p) => {
            const projectTasks = tasks.filter((t) => t.projectId === p.id)
            const value = progress(projectTasks)
            return (
              <article className="card project-card" key={p.id}>
                <div className="row-between">
                  <div className={`project-icon avatar-${p.color}`}>
                    <FolderKanban size={21} />
                  </div>
                  <StatusIndicator status={p.status} />
                </div>
                <p className="eyebrow">
                  {clients.find((c) => c.id === p.clientId)?.name ?? 'Internal project'}
                </p>
                <h2>
                  <Link to={`${base}/projects/${p.id}`}>
                    {p.name}
                    <ArrowUpRight size={16} />
                  </Link>
                </h2>
                <p className="project-description muted">{p.description}</p>
                <div className="progress-label">
                  <span>Task completion</span>
                  <strong>{value}%</strong>
                </div>
                <Progress value={value} label={`${p.name} task completion`} />
                <div className="project-card-footer">
                  <div className="avatar-group">
                    {p.memberIds
                      .map((id) => members.find((m) => m.id === id))
                      .filter((m) => !!m)
                      .map((m) => (
                        <Avatar key={m.id} name={m.name} color={m.color} size="small" />
                      ))}
                  </div>
                  <span>
                    <CalendarDays size={14} />
                    {formatDate(p.dueAt)}
                  </span>
                </div>
              </article>
            )
          })}
        </div>
      ) : (
        <div className="card table-card">
          <Table<Project>
            rows={filtered}
            getKey={(p) => p.id}
            caption="Demo projects"
            columns={[
              {
                label: 'Project',
                render: (p) => (
                  <Link className="table-title" to={`${base}/projects/${p.id}`}>
                    {p.name}
                  </Link>
                ),
              },
              {
                label: 'Client',
                render: (p) => clients.find((c) => c.id === p.clientId)?.name ?? 'Internal',
              },
              { label: 'Status', render: (p) => <StatusIndicator status={p.status} /> },
              {
                label: 'Progress',
                render: (p) => `${progress(tasks.filter((t) => t.projectId === p.id))}%`,
              },
              { label: 'Deadline', render: (p) => formatDate(p.dueAt) },
            ]}
          />
        </div>
      )}
      {creating && <ProjectForm onClose={() => setCreating(false)} />}
    </>
  )
}
