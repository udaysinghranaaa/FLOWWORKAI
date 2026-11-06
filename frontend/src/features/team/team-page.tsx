import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { UserPlus, Mail, Users } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { useDemo } from '@/hooks/use-demo'
import { PageHeader, EmptyState, SectionHeading } from '@/components/shared/page'
import { Button } from '@/components/ui/button'
import { Avatar, Badge, Card, Table } from '@/components/ui/display'
import { SearchInput, Select, Field, Input } from '@/components/ui/fields'
import { Modal } from '@/components/ui/overlays'
import type { Role } from '@/types/domain'

const schema = z.object({
  email: z.email('Enter a valid email address.'),
  role: z.enum(['Owner', 'Admin', 'Manager', 'Member', 'Client']),
})
function InviteForm({ onClose }: { onClose: () => void }) {
  const { workspaceId, repository } = useDemo()
  const [failure, setFailure] = useState('')
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', role: 'Member' },
  })
  return (
    <Modal
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      title="Invite a teammate"
      description="Create a pending demo invitation. No email is sent and no real access is granted."
    >
      <form
        className="form-stack"
        noValidate
        onSubmit={handleSubmit((values) => {
          try {
            repository.invite({ ...values, workspaceId })
            toast.success('Pending demo invitation added · no email sent')
            onClose()
          } catch (e) {
            setFailure(e instanceof Error ? e.message : 'Unable to add demo invitation.')
          }
        })}
      >
        <Field id="invite-email" label="Email address" error={errors.email?.message}>
          <Input
            autoFocus
            id="invite-email"
            type="email"
            {...register('email')}
            aria-describedby={errors.email ? 'invite-email-error' : undefined}
            aria-invalid={!!errors.email}
          />
        </Field>
        <Field id="invite-role" label="Workspace role">
          <Select id="invite-role" {...register('role')}>
            {['Owner', 'Admin', 'Manager', 'Member', 'Client'].map((r) => (
              <option key={r}>{r}</option>
            ))}
          </Select>
        </Field>
        <p className="field-hint">
          The Owner demo persona can preview these roles. Real role changes, owner protections,
          client linking, and invitation delivery require server-side enforcement.
        </p>
        {failure && (
          <p role="alert" className="field-error">
            {failure}
          </p>
        )}
        <div className="form-actions">
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary">
            Add demo invitation
          </Button>
        </div>
      </form>
    </Modal>
  )
}
export default function TeamPage() {
  const { members, projects, tasks, state, workspaceId, base } = useDemo()
  const { memberId } = useParams()
  const [search, setSearch] = useState('')
  const [role, setRole] = useState('all')
  const [inviteOpen, setInviteOpen] = useState(false)
  const member = members.find((m) => m.id === memberId)
  const filtered = members.filter(
    (m) =>
      `${m.name} ${m.discipline}`.toLowerCase().includes(search.toLowerCase()) &&
      (role === 'all' || m.role === role),
  )
  const invitations = state.invitations.filter((i) => i.workspaceId === workspaceId)
  if (memberId)
    return member ? (
      <>
        <Link className="back-link" to={`${base}/team`}>
          ← All teammates
        </Link>
        <PageHeader title={member.name} description={member.discipline} />
        <Card className="member-profile">
          <Avatar name={member.name} color={member.color} size="large" />
          <div>
            <h2>{member.name}</h2>
            <p className="muted">{member.email}</p>
            <Badge tone="violet">{member.role}</Badge>
            <Badge tone="green">{member.status}</Badge>
          </div>
        </Card>
        <div className="two-column">
          <Card>
            <SectionHeading title="Project membership" />
            {projects
              .filter((p) => p.memberIds.includes(member.id))
              .map((p) => (
                <Link className="project-row" key={p.id} to={`${base}/projects/${p.id}`}>
                  {p.name}
                </Link>
              ))}
          </Card>
          <Card>
            <SectionHeading title="Assigned work" />
            <p className="large-number">
              {tasks.filter((t) => t.assigneeId === member.id && t.status !== 'done').length}
            </p>
            <p className="muted">Open tasks · demo assignments</p>
            <Button asChild>
              <Link to={`${base}/tasks`}>Browse tasks</Link>
            </Button>
          </Card>
        </div>
      </>
    ) : (
      <EmptyState title="Teammate not found" />
    )
  return (
    <>
      <PageHeader
        eyebrow="MANY TALENTS. ONE SHARED DIRECTION."
        title="The team"
        description="Meet the people turning plans into thoughtful work."
        action={
          <Button variant="primary" onClick={() => setInviteOpen(true)}>
            <UserPlus size={16} />
            Invite member
          </Button>
        }
      />
      <div className="team-summary">
        <Card>
          <Users size={20} />
          <strong>{members.filter((m) => m.role !== 'Client').length}</strong>
          <span>Internal teammates</span>
        </Card>
        <Card>
          <span className="availability active" />
          <strong>{members.filter((m) => m.status === 'active').length}</strong>
          <span>Active demo profiles</span>
        </Card>
        <Card>
          <Mail size={20} />
          <strong>{invitations.length}</strong>
          <span>Pending demo invitations</span>
        </Card>
      </div>
      <div className="filter-bar">
        <SearchInput
          value={search}
          onChange={setSearch}
          label="Search team"
          placeholder="Search by name or discipline…"
        />
        <Select
          aria-label="Filter team role"
          value={role}
          onChange={(e) => setRole(e.target.value)}
        >
          <option value="all">All roles</option>
          {(['Owner', 'Admin', 'Manager', 'Member', 'Client'] satisfies Role[]).map((r) => (
            <option key={r}>{r}</option>
          ))}
        </Select>
      </div>
      <div className="card table-card">
        <Table
          rows={filtered}
          getKey={(m) => m.id}
          caption="Fictional team directory"
          columns={[
            {
              label: 'Teammate',
              render: (m) => (
                <Link to={`${base}/team/${m.id}`} className="person-cell">
                  <Avatar name={m.name} color={m.color} />
                  <span>
                    <strong>{m.name}</strong>
                    <small>{m.email}</small>
                  </span>
                </Link>
              ),
            },
            { label: 'Discipline', render: (m) => m.discipline },
            {
              label: 'Role',
              render: (m) => (
                <Badge tone={m.role === 'Owner' ? 'violet' : 'neutral'}>{m.role}</Badge>
              ),
            },
            {
              label: 'Status',
              render: (m) => (
                <span className="inline-flex items-center gap-2 capitalize">
                  <span className={`availability ${m.status}`} />
                  {m.status}
                </span>
              ),
            },
            {
              label: 'Projects',
              render: (m) => projects.filter((p) => p.memberIds.includes(m.id)).length,
            },
          ]}
        />
        {!filtered.length && (
          <EmptyState title="No teammates match" description="Try another name or role." />
        )}
      </div>
      <Card>
        <SectionHeading
          title="Pending invitations"
          subtitle="Preview records only · no emails or access grants"
        />
        {invitations.map((i) => (
          <div className="invitation-row" key={i.id}>
            <Mail size={17} />
            <span>{i.email}</span>
            <Badge>{i.role}</Badge>
            <Badge tone="amber">Pending · demo</Badge>
          </div>
        ))}
        {!invitations.length && <p className="muted">No pending demo invitations.</p>}
      </Card>
      {inviteOpen && <InviteForm onClose={() => setInviteOpen(false)} />}
    </>
  )
}
