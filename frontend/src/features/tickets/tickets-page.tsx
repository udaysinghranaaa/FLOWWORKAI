import { useState } from 'react'
import { Link } from 'react-router'
import { Plus, LifeBuoy } from 'lucide-react'
import { useDemo } from '@/hooks/use-demo'
import { PageHeader, EmptyState } from '@/components/shared/page'
import { Button } from '@/components/ui/button'
import { SearchInput, Select } from '@/components/ui/fields'
import {
  Table,
  StatusIndicator,
  PriorityBadge,
  Avatar,
  Badge,
  Pagination,
} from '@/components/ui/display'
import { ticketLabels } from '@/types/domain'
import { formatDate } from '@/lib/utils'
import TicketForm from './ticket-form'

export default function TicketsPage({ portal = false }: { portal?: boolean }) {
  const { tickets, clients, members, base } = useDemo()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [priority, setPriority] = useState('all')
  const [creating, setCreating] = useState(false)
  const [page, setPage] = useState(1)
  const visible = tickets.filter((t) => !portal || t.clientId === 'c-orbit')
  const filtered = visible.filter(
    (t) =>
      `${t.subject} ${t.number}`.toLowerCase().includes(search.toLowerCase()) &&
      (status === 'all' || t.status === status) &&
      (priority === 'all' || t.priority === priority),
  )
  const activePage = Math.min(page, Math.max(1, Math.ceil(filtered.length / 8)))
  return (
    <>
      <PageHeader
        eyebrow="EVERY REQUEST DESERVES A CLEAR NEXT STEP"
        title={portal ? 'Support requests' : 'Support inbox'}
        description={
          portal
            ? 'A direct line to your project team. Public conversations only in this preview.'
            : 'Keep client conversations organized, considered, and moving forward.'
        }
        action={
          <Button variant="primary" onClick={() => setCreating(true)}>
            <Plus size={16} />
            {portal ? 'New request' : 'Create ticket'}
          </Button>
        }
      />
      <div className="ticket-summary">
        {Object.entries(ticketLabels).map(([s, label]) => (
          <button
            key={s}
            className={status === s ? 'selected' : ''}
            onClick={() => {
              setStatus(s)
              setPage(1)
            }}
          >
            <span>{label}</span>
            <strong>{visible.filter((t) => t.status === s).length}</strong>
          </button>
        ))}
      </div>
      <div className="filter-bar">
        <SearchInput
          label="Search tickets"
          value={search}
          onChange={(v) => {
            setSearch(v)
            setPage(1)
          }}
          placeholder="Search ticket subject or number…"
        />
        <Select
          aria-label="Ticket status filter"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value)
            setPage(1)
          }}
        >
          <option value="all">All statuses</option>
          {Object.entries(ticketLabels).map(([s, label]) => (
            <option key={s} value={s}>
              {label}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Ticket priority filter"
          value={priority}
          onChange={(e) => {
            setPriority(e.target.value)
            setPage(1)
          }}
        >
          <option value="all">All priorities</option>
          {['low', 'normal', 'high', 'urgent'].map((p) => (
            <option key={p}>{p}</option>
          ))}
        </Select>
      </div>
      {filtered.length ? (
        <div className="card table-card">
          <Table
            rows={filtered.slice((activePage - 1) * 8, activePage * 8)}
            getKey={(t) => t.id}
            caption="Demo support tickets"
            columns={[
              {
                label: 'Ticket',
                render: (t) => (
                  <div>
                    <span className="task-code">#{t.number}</span>
                    <Link
                      className="table-title"
                      to={`${base}/${portal ? 'portal/' : ''}tickets/${t.id}`}
                    >
                      {t.subject}
                    </Link>
                    <small className="muted">
                      {clients.find((c) => c.id === t.clientId)?.name} · {formatDate(t.createdAt)}
                    </small>
                  </div>
                ),
              },
              { label: 'Status', render: (t) => <StatusIndicator status={t.status} ticket /> },
              { label: 'Priority', render: (t) => <PriorityBadge priority={t.priority} /> },
              { label: 'Category', render: (t) => <Badge>{t.category}</Badge> },
              ...(!portal
                ? [
                    {
                      label: 'Assignee',
                      render: (t: (typeof tickets)[number]) => {
                        const m = members.find((m) => m.id === t.assigneeId)
                        return m ? (
                          <span className="person-cell">
                            <Avatar name={m.name} color={m.color} size="small" />
                            {m.name}
                          </span>
                        ) : (
                          <span className="muted">Unassigned</span>
                        )
                      },
                    },
                  ]
                : []),
            ]}
          />
          <Pagination page={activePage} total={filtered.length} pageSize={8} onChange={setPage} />
        </div>
      ) : (
        <EmptyState
          title="Your inbox is clear"
          description="No support requests match these filters."
          icon={<LifeBuoy size={25} />}
          action={<Button onClick={() => setCreating(true)}>Create a demo request</Button>}
        />
      )}
      {creating && <TicketForm portal={portal} onClose={() => setCreating(false)} />}
    </>
  )
}
