import { useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router'
import { Pencil, MessageSquare, Paperclip } from 'lucide-react'
import { toast } from 'sonner'
import { useDemo } from '@/hooks/use-demo'
import { formatDate } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Avatar, Badge, PriorityBadge, StatusIndicator } from '@/components/ui/display'
import { Select, Textarea } from '@/components/ui/fields'
import { Sheet } from '@/components/ui/overlays'
import { EmptyState, PageHeader } from '@/components/shared/page'
import { taskLabels, type TaskStatus } from '@/types/domain'
import TaskForm from './task-form'

export default function TaskDetailPage() {
  const { taskId } = useParams()
  const { tasks, projects, members, base, repository, workspaceId, state } = useDemo()
  const navigate = useNavigate()
  const [editing, setEditing] = useState(false)
  const [comment, setComment] = useState('')
  const [visibility, setVisibility] = useState<'internal' | 'client'>('internal')
  const task = tasks.find((t) => t.id === taskId)
  if (!task)
    return (
      <EmptyState
        title="Task not found"
        description="This task is not part of the selected demo workspace."
        action={
          <Button asChild>
            <Link to={`${base}/tasks`}>Back to tasks</Link>
          </Button>
        }
      />
    )
  const assignee = members.find((m) => m.id === task.assigneeId)
  const project = projects.find((p) => p.id === task.projectId)
  const comments = state.comments.filter(
    (c) => c.workspaceId === workspaceId && c.taskId === task.id,
  )
  return (
    <>
      <PageHeader
        title="Task details"
        description="A focused view of the work, context, and conversation."
      />
      <Sheet
        open
        onOpenChange={(open) => {
          if (!open) navigate(`${base}/tasks`)
        }}
        title={task.id}
        description="Demo task · Your edits stay in memory until refresh."
      >
        <div className="task-detail">
          <div className="row-between">
            <Badge tone="violet">{project?.name}</Badge>
            <Button size="small" onClick={() => setEditing(true)}>
              <Pencil size={14} />
              Edit task
            </Button>
          </div>
          <h2>{task.title}</h2>
          <div className="task-property-grid">
            <span className="muted">Status</span>
            <Select
              aria-label="Task status"
              value={task.status}
              onChange={(e) => {
                repository.updateTask(workspaceId, task.id, {
                  status: e.target.value as TaskStatus,
                })
                toast.success('Status updated in demo')
              }}
            >
              {Object.entries(taskLabels).map(([s, label]) => (
                <option key={s} value={s}>
                  {label}
                </option>
              ))}
            </Select>
            <span className="muted">Priority</span>
            <PriorityBadge priority={task.priority} />
            <span className="muted">Assignee</span>
            <span className="inline-flex items-center gap-2">
              {assignee && <Avatar name={assignee.name} color={assignee.color} size="small" />}
              {assignee?.name ?? 'Unassigned'}
            </span>
            <span className="muted">Due date</span>
            <span>{formatDate(task.dueAt)} · UTC</span>
          </div>
          <h3>Description</h3>
          <p className="prose-text">{task.description || 'No description yet.'}</p>
          <div className="attachment-preview">
            <Paperclip size={17} />
            <span>Attachments</span>
            <Button
              size="small"
              onClick={() =>
                toast.info(
                  'File uploads need the backend and private storage. No file was uploaded.',
                )
              }
            >
              Upload preview
            </Button>
          </div>
          <div className="section-heading">
            <h3>Conversation</h3>
            <MessageSquare size={17} className="muted" />
          </div>
          <div className="conversation">
            {comments.length ? (
              comments.map((c) => (
                <article key={c.id} className="comment">
                  <Avatar name={c.author} size="small" />
                  <div>
                    <div className="comment-meta">
                      <strong>{c.author}</strong>
                      <Badge>{c.visibility}</Badge>
                      <time dateTime={c.createdAt}>{formatDate(c.createdAt)}</time>
                    </div>
                    <p>{c.body}</p>
                  </div>
                </article>
              ))
            ) : (
              <p className="muted">Start the conversation.</p>
            )}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (!comment.trim()) return
              repository.addComment({
                workspaceId,
                taskId: task.id,
                author: 'Jordan Lee · demo',
                body: comment.trim(),
                visibility,
              })
              setComment('')
              toast.success('Comment added in demo')
            }}
            className="form-stack"
          >
            <label htmlFor="task-comment">Add a comment</label>
            <Textarea
              id="task-comment"
              maxLength={2000}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Share context with the team…"
            />
            <div className="row-between">
              <Select
                aria-label="Comment visibility"
                value={visibility}
                onChange={(e) => setVisibility(e.target.value as 'internal' | 'client')}
              >
                <option value="internal">Internal note</option>
                {task.clientVisible && project?.clientVisible && (
                  <option value="client">Client-visible feedback</option>
                )}
              </Select>
              <Button type="submit" variant="primary" disabled={!comment.trim()}>
                Post comment
              </Button>
            </div>
          </form>
          <StatusIndicator status={task.status} />
        </div>
      </Sheet>
      {editing && <TaskForm task={task} onClose={() => setEditing(false)} />}
    </>
  )
}
