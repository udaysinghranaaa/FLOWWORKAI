import { useState } from 'react'
import { Link } from 'react-router'
import { Plus, List, Columns3 } from 'lucide-react'
import { useDemo } from '@/hooks/use-demo'
import { useUIStore } from '@/stores/ui-store'
import { PageHeader, EmptyState } from '@/components/shared/page'
import { Button } from '@/components/ui/button'
import { SearchInput, Select } from '@/components/ui/fields'
import { Table, StatusIndicator, Avatar, PriorityBadge, Pagination } from '@/components/ui/display'
import { formatDate, isOverdue } from '@/lib/utils'
import { taskLabels, type Task } from '@/types/domain'
import Kanban from './kanban'

export default function TasksPage({
  projectId,
  embedded = false,
}: {
  projectId?: string
  embedded?: boolean
}) {
  const { tasks, projects, members, base } = useDemo()
  const setCreate = useUIStore((s) => s.setTaskCreateOpen)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [assignee, setAssignee] = useState('all')
  const [view, setView] = useState<'list' | 'board'>('list')
  const [page, setPage] = useState(1)
  const filtered = tasks.filter(
    (t) =>
      (!projectId || t.projectId === projectId) &&
      t.title.toLowerCase().includes(search.toLowerCase()) &&
      (status === 'all' || t.status === status || (status === 'overdue' && isOverdue(t))) &&
      (assignee === 'all' || t.assigneeId === assignee),
  )
  const activePage = Math.min(page, Math.max(1, Math.ceil(filtered.length / 8)))
  const columns = [
    {
      label: 'Task',
      render: (t: Task) => (
        <div>
          <span className="task-code">{t.id}</span>
          <Link className="table-title" to={`${base}/tasks/${t.id}`}>
            {t.title}
          </Link>
        </div>
      ),
    },
    { label: 'Status', render: (t: Task) => <StatusIndicator status={t.status} /> },
    { label: 'Priority', render: (t: Task) => <PriorityBadge priority={t.priority} /> },
    {
      label: 'Assignee',
      render: (t: Task) => {
        const m = members.find((m) => m.id === t.assigneeId)
        return m ? (
          <span className="person-cell">
            <Avatar name={m.name} color={m.color} size="small" />
            <span>{m.name}</span>
          </span>
        ) : (
          'Unassigned'
        )
      },
    },
    {
      label: 'Due date',
      render: (t: Task) => (
        <span className={isOverdue(t) ? 'danger-text' : 'muted'}>
          {formatDate(t.dueAt)}
          {isOverdue(t) && <small> · Overdue</small>}
        </span>
      ),
    },
    ...(!projectId
      ? [
          {
            label: 'Project',
            render: (t: Task) => (
              <Link className="muted-link" to={`${base}/projects/${t.projectId}`}>
                {projects.find((p) => p.id === t.projectId)?.name}
              </Link>
            ),
          },
        ]
      : []),
  ]
  return (
    <>
      {!embedded && (
        <PageHeader
          eyebrow="MAKE ROOM FOR FOCUSED WORK"
          title="My tasks"
          description="The next steps that move good work forward. Showing all demo assignments."
          action={
            <Button variant="primary" onClick={() => setCreate(true)}>
              <Plus size={16} />
              Create task
            </Button>
          }
        />
      )}
      <div className="filter-bar">
        <SearchInput
          value={search}
          onChange={(v) => {
            setSearch(v)
            setPage(1)
          }}
          label="Search tasks"
          placeholder="Search tasks…"
        />
        <Select
          aria-label="Filter task status"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value)
            setPage(1)
          }}
        >
          <option value="all">All statuses</option>
          <option value="overdue">Overdue</option>
          {Object.entries(taskLabels).map(([v, label]) => (
            <option key={v} value={v}>
              {label}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Filter assignee"
          value={assignee}
          onChange={(e) => {
            setAssignee(e.target.value)
            setPage(1)
          }}
        >
          <option value="all">All assignees</option>
          {members
            .filter((m) => m.role !== 'Client')
            .map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
        </Select>
        <div className="view-switch" aria-label="Task view">
          <Button
            aria-pressed={view === 'list'}
            variant={view === 'list' ? 'secondary' : 'ghost'}
            size="small"
            onClick={() => setView('list')}
          >
            <List size={16} />
            List
          </Button>
          <Button
            aria-pressed={view === 'board'}
            variant={view === 'board' ? 'secondary' : 'ghost'}
            size="small"
            onClick={() => setView('board')}
          >
            <Columns3 size={16} />
            Board
          </Button>
        </div>
      </div>
      {!filtered.length ? (
        <EmptyState
          title="No matching tasks"
          description="Try a different filter, or start with a new task."
          action={<Button onClick={() => setCreate(true)}>Create task</Button>}
        />
      ) : view === 'board' ? (
        <Kanban tasks={filtered} onCreate={() => setCreate(true)} />
      ) : (
        <div className="card table-card">
          <Table
            rows={filtered.slice((activePage - 1) * 8, activePage * 8)}
            getKey={(t) => t.id}
            columns={columns}
            caption="Demo tasks"
          />
          <Pagination page={activePage} pageSize={8} total={filtered.length} onChange={setPage} />
        </div>
      )}
    </>
  )
}
