import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { useDemo } from '@/hooks/use-demo'
import { Button } from '@/components/ui/button'
import { Field, Input, Select, Textarea } from '@/components/ui/fields'
import { Modal } from '@/components/ui/overlays'
const schema = z.object({
  subject: z.string().trim().min(5, 'Use at least 5 characters.').max(240),
  body: z.string().trim().min(10, 'Add at least 10 characters of context.').max(5000),
  clientId: z.string().min(1, 'Choose a client.'),
  projectId: z.string(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']),
  category: z.enum(['Design', 'Technical', 'Content', 'General']),
})
type Values = z.infer<typeof schema>
export default function TicketForm({
  onClose,
  portal = false,
}: {
  onClose: () => void
  portal?: boolean
}) {
  const { clients, projects, workspaceId, repository } = useDemo()
  const [failure, setFailure] = useState('')
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      subject: '',
      body: '',
      clientId: portal ? 'c-orbit' : (clients[0]?.id ?? ''),
      projectId: '',
      priority: 'normal',
      category: 'General',
    },
  })
  const clientId = useWatch({ control, name: 'clientId' })
  return (
    <Modal
      open
      onOpenChange={(v) => {
        if (!v) onClose()
      }}
      title={portal ? 'Create a support request' : 'Create a ticket'}
    >
      <form
        noValidate
        className="form-stack"
        onSubmit={handleSubmit(({ body, ...values }) => {
          try {
            repository.createTicket(
              { ...values, workspaceId, assigneeId: '', status: 'open' },
              body,
            )
            toast.success('Support request added in demo')
            onClose()
          } catch (e) {
            setFailure(e instanceof Error ? e.message : 'Unable to create ticket.')
          }
        })}
      >
        <Field label="Subject" id="ticket-subject" error={errors.subject?.message}>
          <Input
            id="ticket-subject"
            {...register('subject')}
            autoFocus
            aria-invalid={!!errors.subject}
            aria-describedby={errors.subject ? 'ticket-subject-error' : undefined}
            placeholder="How can the team help?"
          />
        </Field>
        <Field label="Description" id="ticket-body" error={errors.body?.message}>
          <Textarea id="ticket-body" {...register('body')} placeholder="Share a little context…" />
        </Field>
        <div className="form-grid">
          <Field label="Client" id="ticket-client" error={errors.clientId?.message}>
            <Select id="ticket-client" {...register('clientId')} disabled={portal}>
              <option value="">Choose client</option>
              {clients
                .filter((c) => !portal || c.id === 'c-orbit')
                .map((c) => (
                  <option value={c.id} key={c.id}>
                    {c.name}
                  </option>
                ))}
            </Select>
          </Field>
          <Field label="Project (optional)" id="ticket-project">
            <Select id="ticket-project" {...register('projectId')}>
              <option value="">General support</option>
              {projects
                .filter((p) => p.clientId === clientId && (!portal || p.clientVisible))
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
            </Select>
          </Field>
        </div>
        <div className="form-grid">
          <Field label="Priority" id="ticket-priority">
            <Select id="ticket-priority" {...register('priority')}>
              {['low', 'normal', 'high', 'urgent'].map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Category" id="ticket-category">
            <Select id="ticket-category" {...register('category')}>
              {['General', 'Design', 'Technical', 'Content'].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Select>
          </Field>
        </div>
        {failure && (
          <p role="alert" className="field-error">
            {failure}
          </p>
        )}
        <div className="form-actions">
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" type="submit" disabled={!clients.length}>
            Create {portal ? 'request' : 'ticket'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
