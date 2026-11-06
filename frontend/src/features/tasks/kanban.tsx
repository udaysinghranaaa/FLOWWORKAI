import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  useDroppable,
  closestCorners,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, CalendarDays, Plus } from 'lucide-react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { useDemo } from '@/hooks/use-demo'
import { formatDate, cn } from '@/lib/utils'
import { taskLabels, taskStatuses, type Task, type TaskStatus } from '@/types/domain'
import { Avatar, Badge, PriorityBadge } from '@/components/ui/display'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/fields'

function TaskCard({ task }: { task: Task }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
  })
  const { base, members, repository, workspaceId } = useDemo()
  const member = members.find((m) => m.id === task.assigneeId)
  return (
    <article
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn('kanban-card', isDragging && 'dragging')}
    >
      <div className="row-between">
        <span className="task-code">{task.id}</span>
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="drag-handle"
          aria-label={`Drag ${task.title}`}
        >
          <GripVertical size={16} />
        </button>
      </div>
      <Link className="task-card-title" to={`${base}/tasks/${task.id}`}>
        {task.title}
      </Link>
      <PriorityBadge priority={task.priority} />
      <div className="kanban-card-footer">
        <span>
          <CalendarDays size={13} />
          {formatDate(task.dueAt)}
        </span>
        {member ? (
          <Avatar name={member.name} color={member.color} size="small" />
        ) : (
          <span className="muted">Unassigned</span>
        )}
      </div>
      <Select
        className="kanban-status"
        aria-label={`Status for ${task.title}`}
        value={task.status}
        onChange={(e) => {
          repository.updateTask(workspaceId, task.id, { status: e.target.value as TaskStatus })
          toast.success('Task moved in demo')
        }}
      >
        {Object.entries(taskLabels).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </Select>
    </article>
  )
}
function Column({
  status,
  tasks,
  onCreate,
}: {
  status: TaskStatus
  tasks: Task[]
  onCreate: () => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status })
  return (
    <section
      ref={setNodeRef}
      className={cn('kanban-column', isOver && 'kanban-over')}
      aria-label={taskLabels[status]}
    >
      <div className="column-heading">
        <span className={`status-dot dot-${status}`} />
        <h3>{taskLabels[status]}</h3>
        <Badge>{tasks.length}</Badge>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Add task from ${taskLabels[status]}`}
          onClick={onCreate}
        >
          <Plus size={16} />
        </Button>
      </div>
      <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <div className="column-cards">
          {tasks.map((t) => (
            <TaskCard key={t.id} task={t} />
          ))}
          {!tasks.length && (
            <p className="column-empty">No tasks here. A little room to breathe.</p>
          )}
        </div>
      </SortableContext>
    </section>
  )
}
export default function Kanban({ tasks, onCreate }: { tasks: Task[]; onCreate: () => void }) {
  const { repository, workspaceId } = useDemo()
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 7 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  function move({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return
    const task = tasks.find((t) => t.id === active.id)
    if (!task) return
    const target = tasks.find((t) => t.id === over.id)
    const status =
      target?.status ??
      (taskStatuses.includes(over.id as TaskStatus) || over.id === 'backlog'
        ? (over.id as TaskStatus)
        : undefined)
    if (!status) return
    repository.updateTask(workspaceId, task.id, {
      status,
      rank: target
        ? target.rank - 0.1
        : Math.max(0, ...tasks.filter((t) => t.status === status).map((t) => t.rank)) + 1,
    })
    toast.success(`Moved to ${taskLabels[status]} · demo`)
  }
  const columns = tasks.some((t) => t.status === 'backlog')
    ? ['backlog' as TaskStatus, ...taskStatuses]
    : taskStatuses
  return (
    <>
      <p className="muted text-sm board-help">
        Drag a card by its handle, or use its status menu. All changes are local demo changes.
      </p>
      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={move}>
        <div className="kanban" style={{ '--columns': columns.length } as React.CSSProperties}>
          {columns.map((s) => (
            <Column
              key={s}
              status={s}
              tasks={tasks.filter((t) => t.status === s).sort((a, b) => a.rank - b.rank)}
              onCreate={onCreate}
            />
          ))}
        </div>
      </DndContext>
    </>
  )
}
