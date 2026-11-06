import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { useDemo } from '@/hooks/use-demo'
import { priorities, taskLabels, type Task } from '@/types/domain'
import { Button } from '@/components/ui/button'
import { Field, Input, Select, Textarea } from '@/components/ui/fields'
import { Modal } from '@/components/ui/overlays'

const schema = z.object({
  title: z.string().trim().min(3, 'Use at least 3 characters.').max(240),
  description: z.string().max(5000),
  projectId: z.string().min(1, 'Choose a project.'),
  assigneeId: z.string(),
  status: z.enum(['backlog', 'todo', 'in_progress', 'review', 'done']),
  priority: z.enum(['low', 'normal', 'high', 'urgent']),
  dueAt: z.string().min(1, 'Choose a due date.'),
})
type Values = z.infer<typeof schema>
export default function TaskForm({
  task,
  projectId,
  onClose,
}: {
  task?: Task
  projectId?: string
  onClose: () => void
}) {
  const { workspaceId, repository, projects, members } = useDemo()
  const [failure, setFailure] = useState('')
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: task?.title ?? '',
      description: task?.description ?? '',
      projectId: task?.projectId ?? projectId ?? projects[0]?.id ?? '',
      assigneeId: task?.assigneeId ?? '',
      status: task?.status ?? 'todo',
      priority: task?.priority ?? 'normal',
      dueAt: task?.dueAt ?? '2026-11-12',
    },
  })
  const selectedProjectId = useWatch({ control, name: 'projectId' })
  const selectedProject = projects.find((p) => p.id === selectedProjectId)
  const eligibleMembers = members.filter(
    (m) =>
      m.role !== 'Client' &&
      (selectedProject?.memberIds.includes(m.id) || ['Owner', 'Admin'].includes(m.role)),
  )
  const submit = (values: Values) => {
    try {
      repository.saveTask(
        {
          ...values,
          workspaceId,
          clientVisible: task?.clientVisible ?? false,
          publicSummary: task?.publicSummary ?? '',
        },
        task?.id,
      )
      toast.success(task ? 'Task updated in demo' : 'Task created in demo')
      onClose()
    } catch (e) {
      setFailure(e instanceof Error ? e.message : 'Unable to save this demo task.')
    }
  }
  return (
    <Modal
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      title={task ? 'Edit task' : 'Create a task'}
    >
      <form onSubmit={handleSubmit(submit)} className="form-stack" noValidate>
        <Field label="Task title" id="task-title" error={errors.title?.message}>
          <Input
            id="task-title"
            {...register('title')}
            aria-invalid={!!errors.title}
            aria-describedby={errors.title ? 'task-title-error' : undefined}
            placeholder="What needs to get done?"
            autoFocus
          />
        </Field>
        <Field label="Description" id="task-description" error={errors.description?.message}>
          <Textarea
            id="task-description"
            {...register('description')}
            placeholder="Add context, a brief, or a clear outcome…"
          />
        </Field>
        <Field label="Project" id="task-project" error={errors.projectId?.message}>
          <Select id="task-project" {...register('projectId')} disabled={!!task}>
            <option value="">Select a project</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </Field>
        <div className="form-grid">
          <Field label="Status" id="task-status">
            <Select id="task-status" {...register('status')}>
              {Object.entries(taskLabels).map(([s, label]) => (
                <option key={s} value={s}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Priority" id="task-priority">
            <Select id="task-priority" {...register('priority')}>
              {priorities.map((p) => (
                <option key={p} value={p}>
                  {p[0].toUpperCase() + p.slice(1)}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="form-grid">
          <Field label="Assignee" id="task-assignee">
            <Select id="task-assignee" {...register('assigneeId')}>
              <option value="">Unassigned</option>
              {eligibleMembers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Due date (UTC)" id="task-date" error={errors.dueAt?.message}>
            <Input type="date" id="task-date" {...register('dueAt')} />
          </Field>
        </div>
        {failure && (
          <p role="alert" className="field-error">
            {failure}
          </p>
        )}
        {!projects.length && <p className="field-hint">Create a project before adding tasks.</p>}
        <div className="form-actions">
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" type="submit" disabled={isSubmitting || !projects.length}>
            {task ? 'Save task' : 'Create task'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
