import { useRef, useState } from 'react'
import { Link } from 'react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  useDroppable,
  closestCorners,
  pointerWithin,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, ArrowUp, ArrowDown } from 'lucide-react'
import { Card, Badge } from '@/components/ui/display'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/fields'
import { TenantError } from '@/features/workspaces/tenant-context'
import { workApi, type WorkTask, type Board, type BoardColumn } from '@/services/work-api'
import { useWorkScope, useWorkConfig, errorMessage } from './use-work'
import { Options, PendingWork } from './work-ui'
interface Controls {
  disabled: boolean
  ws: string
  projectId: string
  move: (task: WorkTask, status: string, beforeId: string | null) => Promise<void>
  up: () => void
  down: () => void
  canUp: boolean
  canDown: boolean
  statuses: { value: string; label: string }[]
}
function BoardTask({ task, controls }: { task: WorkTask; controls: Controls }) {
  const { setNodeRef, transform, transition, isDragging, attributes, listeners } = useSortable({
    id: task.id,
    disabled: controls.disabled,
  })
  return (
    <article
      ref={setNodeRef}
      className="kanban-card"
      style={{
        transform: CSS.Transform.toString(transform),
        transition: transition,
        opacity: isDragging ? 0.55 : 1,
      }}
    >
      <div className="work-heading">
        <Badge tone={task.priority === 'urgent' ? 'rose' : 'neutral'}>{task.priority}</Badge>
        <button
          type="button"
          className="drag-handle"
          aria-label={`Drag ${task.title}`}
          disabled={controls.disabled}
          style={{ touchAction: 'none' }}
          {...attributes}
          {...listeners}
        >
          <GripVertical size={17} />
        </button>
      </div>
      <Link
        className="task-card-title"
        to={`/app/w/${controls.ws}/projects/${controls.projectId}/tasks/${task.id}`}
      >
        {task.title}
      </Link>
      <p className="muted">Due {task.dueDate ?? 'not set'}</p>
      <p className="muted">{task.assignee?.name ?? 'Unassigned'}</p>
      <Select
        aria-label={`Move ${task.title} to status`}
        value={task.status}
        disabled={controls.disabled}
        onChange={(event) => {
          void controls.move(task, event.target.value, null)
        }}
      >
        <Options values={controls.statuses} />
      </Select>
      <div className="tenant-actions">
        <Button
          size="small"
          aria-label={`Move ${task.title} up`}
          disabled={controls.disabled || !controls.canUp}
          onClick={controls.up}
        >
          <ArrowUp size={14} />
        </Button>
        <Button
          size="small"
          aria-label={`Move ${task.title} down`}
          disabled={controls.disabled || !controls.canDown}
          onClick={controls.down}
        >
          <ArrowDown size={14} />
        </Button>
      </div>
    </article>
  )
}
function Column({
  column,
  label,
  children,
  more,
  disabled,
}: {
  column: BoardColumn
  label: string
  children: React.ReactNode
  more: () => void
  disabled: boolean
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.status, disabled })
  return (
    <section
      ref={setNodeRef}
      className={`kanban-column ${isOver ? 'kanban-over' : ''}`}
      aria-label={`${label} column`}
    >
      <div className="column-heading">
        <h3>{label}</h3>
        <Badge>{column.total}</Badge>
      </div>
      <SortableContext items={column.items.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <div className="column-cards">
          {children}
          {!column.items.length && <p className="column-empty">No tasks here yet.</p>}
        </div>
      </SortableContext>
      {column.nextCursor !== null && (
        <Button disabled={disabled} onClick={more}>
          Load more {label}
        </Button>
      )}
    </section>
  )
}
export default function RealKanban({ projectId }: { projectId: string }) {
  const { ws, key, refresh } = useWorkScope(),
    client = useQueryClient(),
    config = useWorkConfig(),
    [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false),
    lock = useRef(false)
  const boardKey = [...key, projectId, 'board']
  const query = useQuery({
    queryKey: boardKey,
    queryFn: ({ signal }) => workApi.board(ws, projectId, {}, signal),
    retry: false,
    staleTime: 0,
    refetchOnMount: 'always',
  })
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 7 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  async function move(task: WorkTask, status: string, beforeId: string | null) {
    if (lock.current || query.data?.readOnly) return
    lock.current = true
    setBusy(true)
    setNotice('Saving task position...')
    await client.cancelQueries({ queryKey: boardKey })
    const previous = client.getQueryData<Board>(boardKey)
    if (!previous) {
      lock.current = false
      setBusy(false)
      return
    }
    const updated: Board = {
      ...previous,
      columns: previous.columns.map((column) => {
        const items = column.items.filter((item) => item.id !== task.id)
        if (column.status === status) {
          const index = beforeId ? items.findIndex((item) => item.id === beforeId) : -1
          items.splice(index < 0 ? items.length : index, 0, { ...task, status })
        }
        return {
          ...column,
          items,
          total:
            column.total -
            (column.status === task.status ? 1 : 0) +
            (column.status === status ? 1 : 0),
        }
      }),
    }
    client.setQueryData(boardKey, updated)
    try {
      await workApi.move(ws, projectId, task.id, {
        version: task.version,
        boardVersion: previous.version,
        status,
        beforeId,
      })
      setNotice(
        `Task saved in ${config.data?.taskStatuses.find((s) => s.value === status)?.label ?? status}.`,
      )
    } catch (error) {
      client.setQueryData(boardKey, previous)
      setNotice(`Move rolled back. ${errorMessage(error)}`)
    } finally {
      await refresh()
      lock.current = false
      setBusy(false)
    }
  }
  function drop({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id || !query.data) return
    const tasks = query.data.columns.flatMap((c) => c.items),
      task = tasks.find((t) => t.id === active.id),
      target = tasks.find((t) => t.id === over.id),
      status = target?.status ?? query.data.columns.find((c) => c.status === over.id)?.status
    if (task && status) {
      const column = query.data.columns.find((column) => column.status === status)!
      let beforeId = target?.id ?? null
      if (
        target &&
        task.status === status &&
        column.items.findIndex((item) => item.id === task.id) <
          column.items.findIndex((item) => item.id === target.id)
      ) {
        const next = column.items[column.items.findIndex((item) => item.id === target.id) + 1]
        if (!next && column.nextCursor !== null) {
          setNotice('Load more tasks before reordering beyond this page.')
          return
        }
        beforeId = next?.id ?? null
      }
      void move(task, status, beforeId)
    }
  }
  async function more(column: BoardColumn) {
    if (lock.current) return
    lock.current = true
    setBusy(true)
    setNotice('')
    try {
      const response = await workApi.board(ws, projectId, {
        status: column.status,
        cursor: column.nextCursor,
      })
      const current = client.getQueryData<Board>(boardKey)
      if (!current || response.version !== current.version) {
        await refresh()
        setNotice('The board changed. Refreshed before loading more.')
        return
      }
      const next = response.columns[0]!
      client.setQueryData<Board>(boardKey, {
        ...current,
        columns: current.columns.map((c) =>
          c.status === column.status
            ? {
                ...next,
                items: [
                  ...c.items,
                  ...next.items.filter((task) => !c.items.some((old) => old.id === task.id)),
                ],
              }
            : c,
        ),
      })
    } catch (error) {
      setNotice(errorMessage(error))
    } finally {
      lock.current = false
      setBusy(false)
    }
  }
  if (config.isError)
    return (
      <TenantError
        error={config.error}
        retry={() => {
          void config.refetch()
        }}
      />
    )
  if (query.isPending || !config.data || (!query.isFetchedAfterMount && !query.isError))
    return <PendingWork label="Loading Kanban board..." />
  if (query.isError)
    return (
      <TenantError
        error={query.error}
        retry={() => {
          void query.refetch()
        }}
      />
    )
  const board = query.data,
    disabled = busy || board.readOnly
  return (
    <Card>
      <h2>Kanban board</h2>
      <p className="muted">
        Drag by a handle, use Space and arrow keys, or use the status and reorder controls. Each
        column loads twenty tasks at a time. Subtasks appear inside their parent.
      </p>
      {board.readOnly && (
        <p>Read-only board. Your permissions or project status restrict changes.</p>
      )}
      <p role="status" aria-live="polite">
        {notice || 'Task positions are saved to your workspace.'}
      </p>
      <DndContext
        sensors={sensors}
        collisionDetection={(args) => {
          const pointed = pointerWithin(args).filter((collision) => collision.id !== args.active.id)
          return pointed.length ? pointed : closestCorners(args)
        }}
        onDragEnd={drop}
      >
        <div
          className="kanban work-kanban"
          style={{ '--columns': config.data.taskStatuses.length } as React.CSSProperties}
        >
          {board.columns.map((column) => (
            <Column
              key={column.status}
              column={column}
              label={
                config.data!.taskStatuses.find((s) => s.value === column.status)?.label ??
                column.status
              }
              disabled={disabled}
              more={() => {
                void more(column)
              }}
            >
              {column.items.map((task, index) => (
                <BoardTask
                  key={task.id}
                  task={task}
                  controls={{
                    disabled,
                    ws,
                    projectId,
                    move,
                    canUp: index > 0,
                    canDown:
                      index + 1 < column.items.length &&
                      (index + 2 < column.items.length || column.nextCursor === null),
                    up: () => {
                      void move(task, column.status, column.items[index - 1]!.id)
                    },
                    down: () => {
                      void move(task, column.status, column.items[index + 2]?.id ?? null)
                    },
                    statuses: config.data!.taskStatuses,
                  }}
                />
              ))}
            </Column>
          ))}
        </div>
      </DndContext>
    </Card>
  )
}
