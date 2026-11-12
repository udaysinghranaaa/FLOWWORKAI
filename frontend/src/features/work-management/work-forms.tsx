import { TenantError } from '@/features/workspaces/tenant-context'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Field, Input, Textarea, Select } from '@/components/ui/fields'
import { Modal } from '@/components/ui/overlays'
import { workApi, type WorkProject, type WorkTask } from '@/services/work-api'
import { useWorkConfig, useWorkScope, errorMessage } from './use-work'
import { Options, PendingWork } from './work-ui'
const projectSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    slug: z.string().regex(/^[a-z0-9][a-z0-9-]{2,62}$/),
    description: z.string().max(5000),
    status: z.string().min(1),
    priority: z.string().min(1),
    color: z.string().min(1),
    startDate: z.string(),
    dueDate: z.string(),
  })
  .refine((v) => !v.startDate || !v.dueDate || v.startDate <= v.dueDate, {
    path: ['dueDate'],
    message: 'Due date must follow start date.',
  })
export function ProjectForm({ record, close }: { record?: WorkProject; close: () => void }) {
  const scope = useWorkScope(),
    config = useWorkConfig()
  return (
    <Modal
      open
      onOpenChange={(open) => {
        if (!open) close()
      }}
      title={record ? 'Edit project' : 'Create project'}
      description="Changes are saved to this authorized workspace."
    >
      {config.data ? (
        <ProjectFields record={record} config={config.data} close={close} ws={scope.ws} />
      ) : (
        <TenantConfigState query={config} />
      )}
    </Modal>
  )
}
function ProjectFields({
  record,
  config,
  close,
  ws,
}: {
  record: WorkProject | undefined
  config: NonNullable<ReturnType<typeof useWorkConfig>['data']>
  close: () => void
  ws: string
}) {
  const [snapshot] = useState(record),
    [key] = useState(() => crypto.randomUUID()),
    [notice, setNotice] = useState(''),
    { refresh } = useWorkScope()
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof projectSchema>>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      name: record?.name ?? '',
      slug: record?.slug ?? '',
      description: record?.description ?? '',
      status: record?.status ?? config.defaults.projectStatus,
      priority: record?.priority ?? config.defaults.priority,
      color: record?.color ?? config.colors[0],
      startDate: record?.startDate ?? '',
      dueDate: record?.dueDate ?? '',
    },
  })
  return (
    <form
      className="form-stack"
      noValidate
      onSubmit={handleSubmit(async (values) => {
        setNotice('')
        try {
          const body = {
            ...values,
            startDate: values.startDate || null,
            dueDate: values.dueDate || null,
          }
          if (snapshot)
            await workApi.updateProject(ws, snapshot.id, { ...body, version: snapshot.version })
          else await workApi.createProject(ws, { ...body, creationKey: key })
          await refresh()
          close()
        } catch (error) {
          setNotice(errorMessage(error))
        }
      })}
    >
      <Field id="real-project-name" label="Project name" error={errors.name?.message}>
        <Input id="real-project-name" {...register('name')} />
      </Field>
      <Field
        id="real-project-slug"
        label="Project key"
        error={errors.slug?.message}
        hint="3-63 lowercase letters, numbers or hyphens."
      >
        <Input id="real-project-slug" {...register('slug')} />
      </Field>
      <Field id="real-project-description" label="Description" error={errors.description?.message}>
        <Textarea id="real-project-description" {...register('description')} />
      </Field>
      <div className="form-row">
        <Field id="real-project-status" label="Project status">
          <Select id="real-project-status" {...register('status')}>
            <Options values={config.projectStatuses.filter((s) => s.value !== 'archived')} />
          </Select>
        </Field>
        <Field id="real-project-priority" label="Priority">
          <Select id="real-project-priority" {...register('priority')}>
            <Options values={config.priorities} />
          </Select>
        </Field>
      </div>
      <div className="form-row">
        <Field id="real-project-start" label="Start date" error={errors.startDate?.message}>
          <Input id="real-project-start" type="date" {...register('startDate')} />
        </Field>
        <Field id="real-project-due" label="Due date" error={errors.dueDate?.message}>
          <Input id="real-project-due" type="date" {...register('dueDate')} />
        </Field>
      </div>
      <Field id="real-project-color" label="Project color">
        <Select id="real-project-color" {...register('color')}>
          {config.colors.map((color) => (
            <option key={color}>{color}</option>
          ))}
        </Select>
      </Field>
      {notice && <p role="alert">{notice}</p>}
      <div className="tenant-actions">
        <Button type="submit" variant="primary" disabled={isSubmitting}>
          {isSubmitting ? 'Saving...' : snapshot ? 'Save project' : 'Create project'}
        </Button>
        <Button onClick={close} disabled={isSubmitting}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
const taskSchema = z
  .object({
    title: z.string().trim().min(2).max(200),
    description: z.string().max(10000),
    status: z.string().min(1),
    priority: z.string().min(1),
    assigneeId: z.string(),
    labels: z.string().max(320),
    startDate: z.string(),
    dueDate: z.string(),
  })
  .refine((v) => !v.startDate || !v.dueDate || v.startDate <= v.dueDate, {
    path: ['dueDate'],
    message: 'Due date must follow start date.',
  })
export function TaskForm({
  projectId,
  record,
  parentId,
  close,
}: {
  projectId: string
  record?: WorkTask
  parentId?: string
  close: () => void
}) {
  const config = useWorkConfig()
  return (
    <Modal
      open
      onOpenChange={(open) => {
        if (!open) close()
      }}
      title={record ? 'Edit task' : parentId ? 'Create subtask' : 'Create task'}
      description="Task changes, assignment and activity are persisted together."
    >
      {config.data ? (
        <TaskFields
          projectId={projectId}
          record={record}
          parentId={parentId}
          close={close}
          config={config.data}
        />
      ) : (
        <TenantConfigState query={config} />
      )}
    </Modal>
  )
}
function TaskFields({
  projectId,
  record,
  parentId,
  close,
  config,
}: {
  projectId: string
  record: WorkTask | undefined
  parentId: string | undefined
  close: () => void
  config: NonNullable<ReturnType<typeof useWorkConfig>['data']>
}) {
  const { ws, key: queryKey, refresh } = useWorkScope(),
    [snapshot] = useState(record),
    [key] = useState(() => crypto.randomUUID()),
    [notice, setNotice] = useState(''),
    [cursor, setCursor] = useState<string | null>(null)
  const members = useQuery({
    queryKey: [...queryKey, projectId, 'assignee-options', cursor],
    queryFn: () => workApi.members(ws, projectId, { limit: 50, cursor }),
    retry: false,
  })
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof taskSchema>>({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      title: record?.title ?? '',
      description: record?.description ?? '',
      status: record?.status ?? config.defaults.taskStatus,
      priority: record?.priority ?? config.defaults.priority,
      assigneeId: record?.assigneeId ?? '',
      labels: record?.labels.join(', ') ?? '',
      startDate: record?.startDate ?? '',
      dueDate: record?.dueDate ?? '',
    },
  })
  return (
    <form
      className="form-stack"
      noValidate
      onSubmit={handleSubmit(async (values) => {
        setNotice('')
        try {
          const body = {
            ...values,
            assigneeId: values.assigneeId || null,
            startDate: values.startDate || null,
            dueDate: values.dueDate || null,
            labels: values.labels
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean),
          }
          if (snapshot)
            await workApi.updateTask(ws, projectId, snapshot.id, {
              ...body,
              version: snapshot.version,
            })
          else
            await workApi.createTask(ws, projectId, {
              ...body,
              parentTaskId: parentId ?? null,
              creationKey: key,
            })
          await refresh()
          close()
        } catch (error) {
          setNotice(errorMessage(error))
        }
      })}
    >
      <Field id="real-task-title" label="Task title" error={errors.title?.message}>
        <Input id="real-task-title" {...register('title')} />
      </Field>
      <Field id="real-task-description" label="Description" error={errors.description?.message}>
        <Textarea id="real-task-description" {...register('description')} />
      </Field>
      <div className="form-row">
        <Field id="real-task-status" label="Task status">
          <Select id="real-task-status" {...register('status')}>
            <Options values={config.taskStatuses} />
          </Select>
        </Field>
        <Field id="real-task-priority" label="Priority">
          <Select id="real-task-priority" {...register('priority')}>
            <Options values={config.priorities} />
          </Select>
        </Field>
      </div>
      <Field id="real-task-assignee" label="Assignee">
        <Select id="real-task-assignee" {...register('assigneeId')}>
          <option value="">Unassigned</option>
          {record?.assigneeId &&
            !members.data?.items.some((m) => m.userId === record.assigneeId) && (
              <option value={record.assigneeId}>
                {record.assignee?.name ?? 'Current assignee'}
              </option>
            )}
          {members.data?.items
            .filter((m) => m.eligible !== false && m.role !== 'VIEWER')
            .map((m) => (
              <option key={m.id} value={m.userId}>
                {m.name}
              </option>
            ))}
        </Select>
      </Field>
      {members.isError && <p role="alert">Could not load assignees. Retry opening this form.</p>}
      {members.data?.nextCursor && (
        <Button onClick={() => setCursor(members.data!.nextCursor)}>More assignees</Button>
      )}
      {cursor && <Button onClick={() => setCursor(null)}>First assignees</Button>}
      <Field id="real-task-labels" label="Labels (comma separated)" error={errors.labels?.message}>
        <Input id="real-task-labels" {...register('labels')} />
      </Field>
      <div className="form-row">
        <Field id="real-task-start" label="Start date" error={errors.startDate?.message}>
          <Input type="date" id="real-task-start" {...register('startDate')} />
        </Field>
        <Field id="real-task-due" label="Due date" error={errors.dueDate?.message}>
          <Input type="date" id="real-task-due" {...register('dueDate')} />
        </Field>
      </div>
      {notice && <p role="alert">{notice}</p>}
      <div className="tenant-actions">
        <Button type="submit" variant="primary" disabled={isSubmitting}>
          {isSubmitting
            ? 'Saving...'
            : snapshot
              ? 'Save task'
              : parentId
                ? 'Create subtask'
                : 'Create task'}
        </Button>
        <Button onClick={close} disabled={isSubmitting}>
          Cancel
        </Button>
      </div>
    </form>
  )
}

function TenantConfigState({ query }: { query: ReturnType<typeof useWorkConfig> }) {
  return query.isError ? (
    <TenantError
      error={query.error}
      retry={() => {
        void query.refetch()
      }}
    />
  ) : (
    <PendingWork label="Loading form options..." />
  )
}
