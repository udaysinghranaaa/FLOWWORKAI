import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { Plus, ArrowUpRight, Mail, Building2, Pencil } from 'lucide-react'
import { useDemo } from '@/hooks/use-demo'
import { PageHeader, EmptyState, SectionHeading } from '@/components/shared/page'
import { Button } from '@/components/ui/button'
import { Avatar, Badge, Card, StatusIndicator } from '@/components/ui/display'
import { SearchInput, Select } from '@/components/ui/fields'
import ClientForm from './client-form'

export default function ClientsPage() {
  const { clients, projects, base } = useDemo()
  const { clientId } = useParams()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [editing, setEditing] = useState(false)
  const client = clients.find((c) => c.id === clientId)
  if (clientId)
    return client ? (
      <>
        <Link className="back-link" to={`${base}/clients`}>
          ← All clients
        </Link>
        <PageHeader
          eyebrow="CLIENT RELATIONSHIP"
          title={client.name}
          description={client.industry}
          action={
            <Button onClick={() => setEditing(true)}>
              <Pencil size={15} />
              Edit client
            </Button>
          }
        />
        <div className="detail-grid">
          <div>
            <Card>
              <SectionHeading
                title="Shared projects"
                subtitle="Delivery work connected to this client"
              />
              {projects
                .filter((p) => p.clientId === client.id)
                .map((p) => (
                  <Link className="project-row" key={p.id} to={`${base}/projects/${p.id}`}>
                    <Building2 size={20} />
                    <div className="project-row-name">
                      <strong>{p.name}</strong>
                      <p className="muted text-sm">{p.description.slice(0, 75)}…</p>
                    </div>
                    <StatusIndicator status={p.status} />
                    <ArrowUpRight size={16} />
                  </Link>
                ))}
              {!projects.some((p) => p.clientId === client.id) && (
                <EmptyState
                  title="No projects yet"
                  description="Add a project for this client to see it here."
                />
              )}
            </Card>
            <Card>
              <SectionHeading title="Support requests" />
              <Link className="text-link" to={`${base}/tickets`}>
                Open the support inbox
                <ArrowUpRight size={14} />
              </Link>
            </Card>
          </div>
          <aside>
            <Card>
              <SectionHeading title="Primary contact" />
              <div className="person-row">
                <Avatar name={client.contactName} color={client.color} />
                <div>
                  <strong>{client.contactName}</strong>
                  <p className="muted text-sm">Client contact · sample</p>
                </div>
              </div>
              <p className="contact-line">
                <Mail size={16} />
                <span>{client.email}</span>
              </p>
              <p className="contact-line">
                <Building2 size={16} />
                <span>{client.website || 'No website provided'}</span>
              </p>
              <Badge tone={client.status === 'active' ? 'green' : 'neutral'}>{client.status}</Badge>
              <p className="field-hint">
                Fictional company and contact details. No email will be sent.
              </p>
            </Card>
            {client.id === 'c-orbit' && (
              <Button asChild className="w-full">
                <Link to={`${base}/portal/dashboard`}>
                  Explore client portal
                  <ArrowUpRight size={15} />
                </Link>
              </Button>
            )}
          </aside>
        </div>
        {editing && <ClientForm client={client} onClose={() => setEditing(false)} />}
      </>
    ) : (
      <EmptyState
        title="Client not found"
        action={
          <Button asChild>
            <Link to={`${base}/clients`}>Back to clients</Link>
          </Button>
        }
      />
    )
  const filtered = clients.filter(
    (c) =>
      `${c.name} ${c.contactName}`.toLowerCase().includes(search.toLowerCase()) &&
      (status === 'all' || c.status === status),
  )
  return (
    <>
      <PageHeader
        eyebrow="GREAT WORK STARTS WITH PEOPLE"
        title="Clients"
        description="The relationships behind your projects. Keep every conversation in context."
        action={
          <Button variant="primary" onClick={() => setEditing(true)}>
            <Plus size={16} />
            Add client
          </Button>
        }
      />
      <div className="filter-bar">
        <SearchInput
          label="Search clients"
          value={search}
          onChange={setSearch}
          placeholder="Search companies or contacts…"
        />
        <Select
          aria-label="Client status filter"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="all">All clients</option>
          <option value="active">Active</option>
          <option value="archived">Archived</option>
        </Select>
        <span className="muted text-sm">{filtered.length} fictional companies</span>
      </div>
      <div className="client-grid">
        {filtered.map((c) => (
          <Card key={c.id} className="client-card">
            <div className="row-between">
              <div className={`company-avatar avatar-${c.color}`}>{c.name.slice(0, 1)}</div>
              <Badge tone={c.status === 'active' ? 'green' : 'neutral'}>{c.status}</Badge>
            </div>
            <h2>
              <Link to={`${base}/clients/${c.id}`}>
                {c.name}
                <ArrowUpRight size={16} />
              </Link>
            </h2>
            <p className="muted">{c.industry}</p>
            <div className="client-contact">
              <Avatar name={c.contactName} size="small" color={c.color} />
              <div>
                <strong>{c.contactName}</strong>
                <small>{c.email}</small>
              </div>
            </div>
            <div className="row-between client-card-footer">
              <span>{projects.filter((p) => p.clientId === c.id).length} projects</span>
              <Link className="text-link" to={`${base}/clients/${c.id}`}>
                View client
                <ArrowUpRight size={14} />
              </Link>
            </div>
          </Card>
        ))}
      </div>
      {!filtered.length && (
        <EmptyState
          title="No clients found"
          description="Try a different search, or add your first demo client."
        />
      )}
      {editing && <ClientForm onClose={() => setEditing(false)} />}
    </>
  )
}
