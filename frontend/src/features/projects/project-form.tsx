import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { useDemo } from '@/hooks/use-demo'
import type { Project } from '@/types/domain'
import { Button } from '@/components/ui/button'
import { Input, Textarea, Select, Field, Checkbox } from '@/components/ui/fields'
import { Modal } from '@/components/ui/overlays'

const schema = z.object({
  name: z.string().trim().min(3, 'Use at least 3 characters.').max(120),
  description: z.string().max(2000),
  clientId: z.string(),
  dueAt: z.string().min(1, 'Choose a deadline.'),
  status: z.enum(['planned', 'active', 'paused', 'completed', 'archived']),
})
type Values = z.infer<typeof schema>
export default function ProjectForm({
  project,
  onClose,
}: {
  project?: Project
  onClose: () => void
}) {
  const { repository, workspaceId, clients, members } = useDemo()
  const [memberIds, setMemberIds] = useState(
    project?.memberIds ?? members.filter((m) => m.role !== 'Client').map((m) => m.id),
  )
  const [failure, setFailure] = useState('')
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: project?.name ?? '',
      description: project?.description ?? '',
      clientId: project?.clientId ?? clients[0]?.id ?? '',
      dueAt: project?.dueAt ?? '2026-11-30',
      status: project?.status ?? 'planned',
    },
  })
  const submit = (values: Values) => {
    try {
      repository.saveProject(
        {
          ...values,
          workspaceId,
          color: project?.color ?? 'violet',
          memberIds,
          clientVisible: project?.clientVisible ?? false,
        },
        project?.id,
      )
      toast.success(project ? 'Project updated in demo' : 'Project created in demo')
      onClose()
    } catch (e) {
      setFailure(e instanceof Error ? e.message : 'Unable to save this demo project.')
    }
  }
  return (
    <Modal
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      title={project ? 'Edit project' : 'Create a project'}
    >
      <form onSubmit={handleSubmit(submit)} className="form-stack" noValidate>
        <Field label="Project name" id="project-name" error={errors.name?.message}>
          <Input
            id="project-name"
            placeholder="e.g. Summer brand campaign"
            {...register('name')}
            aria-invalid={!!errors.name}
            aria-describedby={errors.name ? 'project-name-error' : undefined}
            autoFocus
          />
        </Field>
        <Field label="Description" id="project-description" error={errors.description?.message}>
          <Textarea
            id="project-description"
            {...register('description')}
            placeholder="What are we working toward?"
          />
        </Field>
        <div className="form-grid">
          <Field label="Client" id="project-client">
            <Select id="project-client" {...register('clientId')}>
              <option value="">Internal project</option>
              {clients
                .filter((c) => c.status === 'active' || c.id === project?.clientId)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </Select>
          </Field>
          <Field label="Deadline (UTC)" id="project-due" error={errors.dueAt?.message}>
            <Input type="date" id="project-due" {...register('dueAt')} />
          </Field>
        </div>
        <Field label="Status" id="project-status">
          <Select id="project-status" {...register('status')}>
            {['planned', 'active', 'paused', 'completed', 'archived'].map((s) => (
              <option key={s} value={s}>
                {s[0].toUpperCase() + s.slice(1)}
              </option>
            ))}
          </Select>
        </Field>
        <fieldset className="member-checks">
          <legend>Project team</legend>
          {members
            .filter((m) => m.role !== 'Client')
            .map((m) => (
              <Checkbox
                key={m.id}
                label={m.name}
                checked={memberIds.includes(m.id)}
                onCheckedChange={(checked) =>
                  setMemberIds((ids) =>
                    checked ? [...ids, m.id] : ids.filter((id) => id !== m.id),
                  )
                }
              />
            ))}
        </fieldset>
        {failure && (
          <p role="alert" className="field-error">
            {failure}
          </p>
        )}
        <div className="form-actions">
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={isSubmitting}>
            {project ? 'Save project' : 'Create project'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
