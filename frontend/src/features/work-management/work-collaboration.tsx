import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, Badge } from '@/components/ui/display'
import { Button } from '@/components/ui/button'
import { Field, Select, Textarea } from '@/components/ui/fields'
import { Modal, ConfirmationDialog } from '@/components/ui/overlays'
import { tenantApi } from '@/services/tenant-api'
import { workApi, type WorkProject, type WorkComment } from '@/services/work-api'
import { useWorkScope, errorMessage } from './use-work'
import { Pager, PendingWork } from './work-ui'
import { TenantError } from '@/features/workspaces/tenant-context'
export function ActivityList({ projectId, taskId }: { projectId: string; taskId?: string }) {
  const { ws, key } = useWorkScope(),
    [cursor, setCursor] = useState<string | null>(null)
  const query = useQuery({
    queryKey: [...key, projectId, taskId ?? 'project', 'activity', cursor],
    queryFn: () => workApi.activity(ws, projectId, { cursor }, taskId),
    retry: false,
    staleTime: 0,
    refetchOnMount: 'always',
  })
  return (
    <Card>
      <h2>Activity history</h2>
      {query.isPending ? (
        <PendingWork />
      ) : query.isError ? (
        <TenantError
          error={query.error}
          retry={() => {
            void query.refetch()
          }}
        />
      ) : (
        <>
          <ol className="work-activity">
            {query.data.items.map((event) => (
              <li key={event.id}>
                <Badge>{event.action.replaceAll('.', ' ').replaceAll('_', ' ')}</Badge>
                <p>
                  {event.actor?.name ?? 'Unavailable account'} -{' '}
                  <time dateTime={event.createdAt}>
                    {new Date(event.createdAt).toLocaleString()}
                  </time>
                </p>
                {event.metadata.from &&
                  event.metadata.to &&
                  event.metadata.from !== event.metadata.to && (
                    <small>
                      {event.metadata.from.replaceAll('_', ' ')} to{' '}
                      {event.metadata.to.replaceAll('_', ' ')}
                    </small>
                  )}
              </li>
            ))}
          </ol>
          {!query.data.items.length && <p>No activity yet.</p>}
          <Pager cursor={cursor} next={query.data.nextCursor} onPage={setCursor} />
        </>
      )}
    </Card>
  )
}
export function ProjectTeam({ project }: { project: WorkProject }) {
  const { ws, key, refresh } = useWorkScope(),
    [cursor, setCursor] = useState<string | null>(null),
    [creating, setCreating] = useState(false),
    [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false),
    [confirm, setConfirm] = useState<{ title: string; run: () => Promise<unknown> } | null>(null)
  const members = useQuery({
    queryKey: [...key, project.id, 'members', cursor],
    queryFn: () => workApi.members(ws, project.id, { cursor }),
    retry: false,
    staleTime: 0,
    refetchOnMount: 'always',
  })
  const manage = project.permissions?.manage && project.status !== 'archived'
  async function perform(action: () => Promise<unknown>) {
    setBusy(true)
    setNotice('')
    try {
      await action()
      await refresh()
      setNotice('Project membership updated.')
    } catch (error) {
      setNotice(errorMessage(error))
    } finally {
      setBusy(false)
      setConfirm(null)
    }
  }
  return (
    <Card>
      <div className="work-heading">
        <h2>Project members</h2>
        {manage && (
          <Button variant="primary" onClick={() => setCreating(true)}>
            Add project member
          </Button>
        )}
      </div>
      {notice && <p role="status">{notice}</p>}
      {members.isPending ? (
        <PendingWork />
      ) : members.isError ? (
        <TenantError
          error={members.error}
          retry={() => {
            void members.refetch()
          }}
        />
      ) : (
        <>
          <div className="tenant-table">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Project access</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {members.data.items.map((member) => (
                  <tr key={member.id}>
                    <td>
                      {member.name}
                      {member.userId === project.ownerUserId && <Badge>Project owner</Badge>}
                      {member.eligible === false && <Badge>Not eligible for task assignment</Badge>}
                    </td>
                    <td>
                      {manage && member.userId !== project.ownerUserId ? (
                        <Select
                          aria-label={`Project role for ${member.name}`}
                          value={member.role}
                          disabled={busy}
                          onChange={(event) => {
                            void perform(() =>
                              workApi.member(ws, project.id, {
                                userId: member.userId,
                                role: event.target.value,
                                version: project.version,
                              }),
                            )
                          }}
                        >
                          {['MANAGER', 'CONTRIBUTOR', 'VIEWER'].map((role) => (
                            <option key={role}>{role}</option>
                          ))}
                        </Select>
                      ) : (
                        <Badge>{member.role}</Badge>
                      )}
                    </td>
                    <td>
                      {manage && member.userId !== project.ownerUserId && (
                        <div className="tenant-actions">
                          <Button
                            disabled={busy}
                            onClick={() =>
                              setConfirm({
                                title: 'Remove project member?',
                                run: () =>
                                  workApi.removeMember(
                                    ws,
                                    project.id,
                                    member.userId,
                                    project.version,
                                  ),
                              })
                            }
                          >
                            Remove from project
                          </Button>
                          {member.role === 'MANAGER' && member.eligible !== false && (
                            <Button
                              disabled={busy}
                              onClick={() =>
                                setConfirm({
                                  title: 'Transfer project ownership?',
                                  run: () =>
                                    workApi.updateProject(ws, project.id, {
                                      ownerUserId: member.userId,
                                      version: project.version,
                                    }),
                                })
                              }
                            >
                              Make project owner
                            </Button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager cursor={cursor} next={members.data.nextCursor} onPage={setCursor} />
        </>
      )}
      {creating && <MemberForm project={project} close={() => setCreating(false)} />}
      <ConfirmationDialog
        open={!!confirm}
        onOpenChange={(open) => {
          if (!open) setConfirm(null)
        }}
        title={confirm?.title ?? 'Confirm membership change'}
        description="Current workspace and project permissions are checked by the server. Other projects remain independent."
        onConfirm={() => {
          if (confirm) void perform(confirm.run)
        }}
      />
    </Card>
  )
}
function MemberForm({ project, close }: { project: WorkProject; close: () => void }) {
  const { ws, key, refresh } = useWorkScope(),
    [cursor, setCursor] = useState<string | null>(null),
    [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false)
  const members = useQuery({
    queryKey: [...key, 'member-options', cursor],
    queryFn: () => tenantApi.members('workspaces', ws, cursor),
    retry: false,
  })
  return (
    <Modal
      open
      onOpenChange={(open) => {
        if (!open) close()
      }}
      title="Add project member"
      description="An active workspace membership is required; grants cannot elevate the workspace role."
    >
      <form
        className="form-stack"
        onSubmit={async (event) => {
          event.preventDefault()
          const data = new FormData(event.currentTarget)
          setBusy(true)
          setNotice('')
          try {
            await workApi.member(ws, project.id, {
              userId: String(data.get('userId')),
              role: String(data.get('role')),
              version: project.version,
            })
            await refresh()
            close()
          } catch (error) {
            setNotice(errorMessage(error))
          } finally {
            setBusy(false)
          }
        }}
      >
        <Field id="project-member-user" label="Workspace member">
          <Select id="project-member-user" name="userId" required defaultValue="">
            <option value="" disabled>
              Choose member
            </option>
            {members.data?.items.map((m) => (
              <option key={m.id} value={m.userId}>
                {m.name} - {m.role}
              </option>
            ))}
          </Select>
        </Field>
        {members.isPending && <p role="status">Loading workspace members...</p>}
        {members.isError && (
          <p role="alert">
            Could not load members.{' '}
            <Button
              onClick={() => {
                void members.refetch()
              }}
            >
              Retry
            </Button>
          </p>
        )}
        {members.data?.nextCursor && (
          <Button onClick={() => setCursor(members.data!.nextCursor)}>
            More workspace members
          </Button>
        )}
        {cursor && <Button onClick={() => setCursor(null)}>First workspace members</Button>}
        <Field id="project-member-role" label="Project access">
          <Select id="project-member-role" name="role">
            <option value="CONTRIBUTOR">CONTRIBUTOR</option>
            <option value="MANAGER">MANAGER (workspace manager required)</option>
            <option value="VIEWER">VIEWER</option>
          </Select>
        </Field>
        {notice && <p role="alert">{notice}</p>}
        <Button type="submit" variant="primary" disabled={busy || members.isPending}>
          {busy ? 'Saving...' : 'Add member'}
        </Button>
      </form>
    </Modal>
  )
}
export function Comments({
  projectId,
  taskId,
  canWrite,
  canModerate,
}: {
  projectId: string
  taskId: string
  canWrite: boolean
  canModerate: boolean
}) {
  const { ws, key, user, refresh } = useWorkScope(),
    [cursor, setCursor] = useState<string | null>(null),
    [text, setText] = useState(''),
    [creationKey, setKey] = useState(() => crypto.randomUUID()),
    [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false),
    [edit, setEdit] = useState<WorkComment | null>(null),
    [remove, setRemove] = useState<WorkComment | null>(null)
  const comments = useQuery({
    queryKey: [...key, projectId, taskId, 'comments', cursor],
    queryFn: () => workApi.comments(ws, projectId, taskId, { cursor }),
    retry: false,
    staleTime: 0,
    refetchOnMount: 'always',
  })
  async function perform(operation: () => Promise<unknown>) {
    setBusy(true)
    setNotice('')
    try {
      await operation()
      await refresh()
      setNotice('Comment saved.')
      return true
    } catch (error) {
      setNotice(errorMessage(error))
      return false
    } finally {
      setBusy(false)
      setRemove(null)
    }
  }
  return (
    <Card>
      <h2>Comments</h2>
      {notice && <p role="status">{notice}</p>}
      {canWrite && (
        <form
          className="form-stack"
          onSubmit={async (event) => {
            event.preventDefault()
            if (
              await perform(() => workApi.comment(ws, projectId, taskId, { text, creationKey }))
            ) {
              setText('')
              setKey(crypto.randomUUID())
            }
          }}
        >
          <Field id="task-comment" label="Add a comment" hint="Plain text, up to 4,000 characters.">
            <Textarea
              id="task-comment"
              value={text}
              onChange={(event) => setText(event.target.value)}
              required
              maxLength={4000}
            />
          </Field>
          <Button type="submit" disabled={busy || !text.trim()} variant="primary">
            Post comment
          </Button>
        </form>
      )}
      {comments.isPending ? (
        <PendingWork />
      ) : comments.isError ? (
        <TenantError
          error={comments.error}
          retry={() => {
            void comments.refetch()
          }}
        />
      ) : (
        <>
          <ul className="work-comments">
            {comments.data.items.map((comment) => (
              <li key={comment.id}>
                <strong>{comment.author?.name ?? 'Unavailable account'}</strong>
                <small>
                  {' '}
                  - {new Date(comment.createdAt).toLocaleString()}
                  {comment.updatedAt !== comment.createdAt ? ' (edited)' : ''}
                </small>
                <p className="work-description">{comment.text}</p>
                {canWrite && (canModerate || comment.authorId === user?.id) && (
                  <div className="tenant-actions">
                    <Button disabled={busy} onClick={() => setEdit(comment)}>
                      Edit comment
                    </Button>
                    <Button disabled={busy} onClick={() => setRemove(comment)}>
                      Delete comment
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
          {!comments.data.items.length && <p className="muted">No comments yet.</p>}
          <Pager cursor={cursor} next={comments.data.nextCursor} onPage={setCursor} />
        </>
      )}
      {edit && (
        <Modal
          open
          onOpenChange={(open) => {
            if (!open) setEdit(null)
          }}
          title="Edit comment"
          description="Only your own comment or an authorized moderation change is accepted."
        >
          <form
            className="form-stack"
            onSubmit={async (event) => {
              event.preventDefault()
              if (
                await perform(() =>
                  workApi.comment(
                    ws,
                    projectId,
                    taskId,
                    { text: edit.text, version: edit.version },
                    edit.id,
                  ),
                )
              )
                setEdit(null)
            }}
          >
            <Field id="edit-comment" label="Comment text">
              <Textarea
                id="edit-comment"
                maxLength={4000}
                required
                value={edit.text}
                onChange={(event) => setEdit({ ...edit, text: event.target.value })}
              />
            </Field>
            <Button type="submit" disabled={busy}>
              Save comment
            </Button>
          </form>
        </Modal>
      )}
      <ConfirmationDialog
        open={!!remove}
        onOpenChange={(open) => {
          if (!open) setRemove(null)
        }}
        title="Delete comment?"
        description="The comment is soft-deleted; its text will no longer be displayed."
        onConfirm={() => {
          if (remove)
            void perform(() =>
              workApi.comment(ws, projectId, taskId, { version: remove.version }, remove.id, true),
            )
        }}
      />
    </Card>
  )
}
