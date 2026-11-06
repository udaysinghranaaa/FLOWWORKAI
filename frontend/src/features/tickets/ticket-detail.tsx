import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { Send, LockKeyhole, Paperclip, MessageSquare } from 'lucide-react'
import { toast } from 'sonner'
import { useDemo } from '@/hooks/use-demo'
import { PageHeader, EmptyState, SectionHeading } from '@/components/shared/page'
import { Button } from '@/components/ui/button'
import { Avatar, Badge, Card, PriorityBadge, StatusIndicator } from '@/components/ui/display'
import { Select, Textarea } from '@/components/ui/fields'
import { UserPicker } from '@/components/shared/user-picker'
import { formatDate } from '@/lib/utils'
import { ticketLabels, type TicketStatus } from '@/types/domain'

export default function TicketDetailPage({ portal = false }: { portal?: boolean }) {
  const { ticketId } = useParams()
  const { tickets, state, clients, members, workspaceId, repository, base } = useDemo()
  const [body, setBody] = useState('')
  const [visibility, setVisibility] = useState<'internal' | 'client'>('client')
  const [failure, setFailure] = useState('')
  const ticket = tickets.find((t) => t.id === ticketId && (!portal || t.clientId === 'c-orbit'))
  if (!ticket)
    return (
      <EmptyState
        title="Request not found"
        description="This request is not part of this demo view."
        action={
          <Button asChild>
            <Link to={`${base}/${portal ? 'portal/' : ''}tickets`}>Back to requests</Link>
          </Button>
        }
      />
    )
  const messages = state.messages.filter(
    (m) =>
      m.workspaceId === workspaceId &&
      m.ticketId === ticket.id &&
      (!portal || m.visibility === 'client'),
  )
  const client = clients.find((c) => c.id === ticket.clientId)
  return (
    <>
      <Link className="back-link" to={`${base}/${portal ? 'portal/' : ''}tickets`}>
        ← Support inbox
      </Link>
      <PageHeader
        eyebrow={`TICKET #${ticket.number}`}
        title={ticket.subject}
        description={`${client?.name} · Opened ${formatDate(ticket.createdAt)} · Demo conversation`}
        action={<StatusIndicator ticket status={ticket.status} />}
      />
      <div className="detail-grid">
        <Card className="conversation-card">
          <SectionHeading
            title="Conversation"
            action={<MessageSquare size={18} className="muted" />}
          />
          <div className="ticket-conversation">
            {messages.map((m) => (
              <article
                key={m.id}
                className={`ticket-message ${m.visibility === 'internal' ? 'internal-message' : ''}`}
              >
                <Avatar name={m.author} size="small" />
                <div>
                  <div className="comment-meta">
                    <strong>{m.author}</strong>
                    {m.visibility === 'internal' && (
                      <Badge tone="amber">
                        <LockKeyhole size={11} />
                        Internal note
                      </Badge>
                    )}
                    <time dateTime={m.createdAt}>{formatDate(m.createdAt)}</time>
                  </div>
                  <p>{m.body}</p>
                </div>
              </article>
            ))}
            {!messages.length && <p className="muted">No messages in this preview thread yet.</p>}
          </div>
          <form
            className="reply-form"
            onSubmit={(e) => {
              e.preventDefault()
              if (!body.trim()) return
              try {
                repository.addMessage({
                  workspaceId,
                  ticketId: ticket.id,
                  author: portal ? 'Riley Park · client demo' : 'Jordan Lee · demo',
                  body: body.trim(),
                  visibility: portal ? 'client' : visibility,
                })
                setBody('')
                toast.success('Message added in demo')
              } catch (e) {
                setFailure(e instanceof Error ? e.message : 'Unable to add message.')
              }
            }}
          >
            <div className="row-between">
              {!portal ? (
                <Select
                  aria-label="Reply visibility"
                  value={visibility}
                  onChange={(e) => setVisibility(e.target.value as 'internal' | 'client')}
                >
                  <option value="client">Public reply</option>
                  <option value="internal">Internal note</option>
                </Select>
              ) : (
                <label htmlFor="reply-body">Reply to your team</label>
              )}
              <Badge tone={visibility === 'internal' && !portal ? 'amber' : 'neutral'}>
                {visibility === 'internal' && !portal
                  ? 'Only shown in staff preview'
                  : 'Client-visible'}
              </Badge>
            </div>
            <label htmlFor="reply-body" className={portal ? 'sr-only' : ''}>
              {portal ? 'Your reply' : visibility === 'internal' ? 'Internal note' : 'Public reply'}
            </label>
            <Textarea
              id="reply-body"
              value={body}
              maxLength={5000}
              onChange={(e) => setBody(e.target.value)}
              placeholder={
                visibility === 'internal' && !portal
                  ? 'Add context for the internal team…'
                  : 'Write a thoughtful reply…'
              }
            />
            {failure && (
              <p role="alert" className="field-error">
                {failure}
              </p>
            )}
            <div className="row-between">
              <Button
                variant="ghost"
                size="small"
                onClick={() =>
                  toast.info('Attachments need private storage and scanning. No upload occurred.')
                }
              >
                <Paperclip size={16} />
                Attach file preview
              </Button>
              <Button type="submit" variant="primary" disabled={!body.trim()}>
                <Send size={15} />
                {visibility === 'internal' && !portal ? 'Add note' : 'Send demo reply'}
              </Button>
            </div>
          </form>
        </Card>
        <aside>
          <Card>
            <SectionHeading title="Request details" />
            <dl className="details-list">
              <dt>Client</dt>
              <dd>{client?.name}</dd>
              <dt>Priority</dt>
              <dd>
                <PriorityBadge priority={ticket.priority} />
              </dd>
              <dt>Category</dt>
              <dd>
                <Badge>{ticket.category}</Badge>
              </dd>
              <dt>Created</dt>
              <dd>{formatDate(ticket.createdAt)}</dd>
            </dl>
            {!portal && (
              <div className="form-stack">
                <label htmlFor="ticket-state">Status</label>
                <Select
                  id="ticket-state"
                  value={ticket.status}
                  onChange={(e) => {
                    repository.updateTicket(workspaceId, ticket.id, {
                      status: e.target.value as TicketStatus,
                    })
                    toast.success('Ticket status updated in demo')
                  }}
                >
                  {Object.entries(ticketLabels).map(([s, label]) => (
                    <option key={s} value={s}>
                      {label}
                    </option>
                  ))}
                </Select>
                <label htmlFor="ticket-assignee-picker">Assignee</label>
                <UserPicker
                  id="ticket-assignee-picker"
                  members={members}
                  value={ticket.assigneeId}
                  onChange={(assigneeId) =>
                    repository.updateTicket(workspaceId, ticket.id, { assigneeId })
                  }
                />
              </div>
            )}
          </Card>
          <Card>
            <SectionHeading title="History preview" />
            <p className="muted text-sm">Request opened {formatDate(ticket.createdAt)}.</p>
            {ticket.resolvedAt && (
              <p className="muted text-sm">Resolved {formatDate(ticket.resolvedAt)}.</p>
            )}
            <p className="field-hint">This frontend does not maintain a server audit trail.</p>
          </Card>
        </aside>
      </div>
    </>
  )
}
