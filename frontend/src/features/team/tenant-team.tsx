import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link, useParams } from 'react-router'
import { tenantApi, type Role, type Workspace } from '@/services/tenant-api'
import { useSession } from '@/features/auth/use-session'
import { TenantHeading, TenantError } from '@/features/workspaces/tenant-context'
import { useWorkspace, useTenantRefresh } from '@/features/workspaces/use-tenant'
import { Badge, Card, LoadingState } from '@/components/ui/display'
import { Field, Input, Select, Textarea } from '@/components/ui/fields'
import { Button } from '@/components/ui/button'
import { Modal, ConfirmationDialog } from '@/components/ui/overlays'

const inviteSchema = z.object({
  email: z.email().max(254),
  organizationRole: z.enum(['ADMIN', 'MEMBER']),
  workspaceRole: z.enum(['ADMIN', 'MANAGER', 'MEMBER', 'VIEWER']),
  workspaceIds: z.array(z.string()).min(1, 'Select at least one workspace.').max(10),
  message: z.string().max(500),
})
function InviteDialog({
  open,
  close,
  organizationId,
  workspaces,
  canManageAdmins,
  companyScope,
}: {
  open: boolean
  close: () => void
  organizationId: string
  workspaces: Workspace[]
  canManageAdmins: boolean
  companyScope: boolean
}) {
  const refresh = useTenantRefresh(),
    [notice, setNotice] = useState('')
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof inviteSchema>>({
    resolver: zodResolver(inviteSchema),
    defaultValues: {
      email: '',
      organizationRole: 'MEMBER',
      workspaceRole: 'MEMBER',
      workspaceIds: workspaces.length === 1 ? [workspaces[0]!.id] : [],
      message: '',
    },
  })
  return (
    <Modal
      open={open}
      onOpenChange={(value) => {
        if (!value) close()
      }}
      title="Invite a teammate"
      description="An invitation grants no access until the matching verified account accepts it."
    >
      <form
        className="form-stack"
        noValidate
        onSubmit={handleSubmit(async (values) => {
          setNotice('')
          try {
            await tenantApi.invite(organizationId, {
              email: values.email,
              organizationRole: values.organizationRole,
              targets: values.workspaceIds.map((workspaceId) => ({
                workspaceId,
                role: values.workspaceRole,
              })),
              message: values.message,
            })
            await refresh()
            close()
          } catch (error) {
            setNotice(error instanceof Error ? error.message : 'Could not create the invitation.')
          }
        })}
      >
        <Field id="invite-email" label="Email address" error={errors.email?.message}>
          <Input id="invite-email" type="email" autoComplete="email" {...register('email')} />
        </Field>
        <Field id="invite-org-role" label="Company role">
          <Select id="invite-org-role" {...register('organizationRole')}>
            <option value="MEMBER">MEMBER</option>
            {canManageAdmins && companyScope && <option value="ADMIN">ADMIN</option>}
          </Select>
        </Field>
        <Field
          id="invite-workspaces"
          label="Target workspaces"
          error={errors.workspaceIds?.message}
          hint="Select up to ten workspaces. Use Ctrl or Command for multiple selections."
        >
          <Select id="invite-workspaces" multiple {...register('workspaceIds')}>
            {workspaces.map((workspace) => (
              <option key={workspace.id} value={workspace.id}>
                {workspace.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field id="invite-workspace-role" label="Workspace role">
          <Select id="invite-workspace-role" {...register('workspaceRole')}>
            {(canManageAdmins
              ? ['ADMIN', 'MANAGER', 'MEMBER', 'VIEWER']
              : ['MANAGER', 'MEMBER', 'VIEWER']
            ).map((role) => (
              <option key={role}>{role}</option>
            ))}
          </Select>
        </Field>
        <Field id="invite-message" label="Message (optional)" error={errors.message?.message}>
          <Textarea id="invite-message" {...register('message')} />
        </Field>
        <p className="muted">
          Development uses private mail capture. No email delivery is claimed by this action.
        </p>
        {notice && <p role="alert">{notice}</p>}
        <Button variant="primary" type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Creating invitation…' : 'Create invitation'}
        </Button>
      </form>
    </Modal>
  )
}
export function TeamDirectory({
  scope,
  organizationId,
  workspaceId,
  permissions,
  role,
}: {
  scope: 'organizations' | 'workspaces'
  organizationId: string
  workspaceId?: string
  permissions: string[]
  role: Role
}) {
  const { data: user } = useSession(),
    refresh = useTenantRefresh(),
    [cursor, setCursor] = useState<string | null>(null),
    [inviteCursor, setInviteCursor] = useState<string | null>(null),
    [inviting, setInviting] = useState(false),
    [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false)
  const [confirm, setConfirm] = useState<{
      title: string
      description: string
      operation: () => Promise<unknown>
    } | null>(null),
    [roles, setRoles] = useState<Record<string, Role>>({})
  const id = scope === 'organizations' ? organizationId : workspaceId!,
    permission = scope === 'organizations' ? 'organization' : 'workspace'
  const canManage = permissions.includes(`${permission}.members.manage`),
    canInvite = permissions.includes(`${permission}.invitations.manage`),
    canManageAdmins = role === 'OWNER'
  const members = useQuery({
    queryKey: ['tenant', user?.id, id, 'members', cursor],
    queryFn: () => tenantApi.members(scope, id, cursor),
    retry: false,
  })
  const invitations = useQuery({
    queryKey: ['tenant', user?.id, id, 'invitations', inviteCursor],
    queryFn: () => tenantApi.invitations(scope, id, inviteCursor),
    enabled: canInvite,
    retry: false,
  })
  const destinations = useQuery({
    queryKey: ['tenant', user?.id, organizationId, 'invite-workspaces'],
    queryFn: () => tenantApi.workspaces(null, organizationId),
    enabled: canInvite,
    retry: false,
  })
  async function perform(operation: () => Promise<unknown>) {
    setBusy(true)
    setNotice('')
    try {
      await operation()
      await refresh()
      setNotice('Change saved.')
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'The change was rejected.')
    } finally {
      setBusy(false)
      setConfirm(null)
    }
  }
  const availableRoles: Role[] =
    scope === 'organizations'
      ? canManageAdmins
        ? ['ADMIN', 'MEMBER']
        : ['MEMBER']
      : canManageAdmins
        ? ['ADMIN', 'MANAGER', 'MEMBER', 'VIEWER']
        : ['MANAGER', 'MEMBER', 'VIEWER']
  return (
    <div className="tenant-page">
      <div className="tenant-page-heading">
        <TenantHeading>
          {scope === 'organizations' ? 'Company team' : 'Workspace team'}
        </TenantHeading>
        {canInvite && (
          <Button variant="primary" onClick={() => setInviting(true)}>
            Invite member
          </Button>
        )}
      </div>
      {notice && <p role="status">{notice}</p>}
      {members.isPending ? (
        <LoadingState label="Loading members…" />
      ) : members.isError ? (
        <TenantError
          error={members.error}
          retry={() => {
            void members.refetch()
          }}
        />
      ) : (
        <Card>
          <div className="tenant-table">
            <table>
              <thead>
                <tr>
                  <th>Name and email</th>
                  <th>Role</th>
                  <th>Joined</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {members.data.items.map((member) => {
                  const mutable =
                    canManage &&
                    member.role !== 'OWNER' &&
                    member.userId !== user?.id &&
                    (canManageAdmins || member.role !== 'ADMIN')
                  return (
                    <tr key={member.id}>
                      <td>
                        <strong>{member.name}</strong>
                        <br />
                        <span className="muted">{member.email}</span>
                      </td>
                      <td>
                        {mutable ? (
                          <Select
                            aria-label={`Role for ${member.name}`}
                            value={roles[member.id] ?? member.role}
                            onChange={(event) =>
                              setRoles((current) => ({
                                ...current,
                                [member.id]: event.target.value as Role,
                              }))
                            }
                          >
                            {availableRoles.map((value) => (
                              <option key={value}>{value}</option>
                            ))}
                          </Select>
                        ) : (
                          <Badge>{member.role}</Badge>
                        )}
                      </td>
                      <td>{new Date(member.joinedAt).toLocaleDateString()}</td>
                      <td>
                        {mutable && (
                          <div className="tenant-actions">
                            <Button
                              disabled={
                                busy || !roles[member.id] || roles[member.id] === member.role
                              }
                              onClick={() => {
                                void perform(() =>
                                  tenantApi.changeRole(scope, id, member.id, roles[member.id]!),
                                )
                              }}
                            >
                              Save role
                            </Button>
                            <Button
                              disabled={busy}
                              onClick={() =>
                                setConfirm({
                                  title: 'Remove member?',
                                  description:
                                    'This revokes membership access. Other company memberships remain independent.',
                                  operation: () => tenantApi.removeMember(scope, id, member.id),
                                })
                              }
                            >
                              Remove
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {members.data.nextCursor && (
            <Button onClick={() => setCursor(members.data.nextCursor)}>Next members</Button>
          )}
          {cursor && <Button onClick={() => setCursor(null)}>First members</Button>}
        </Card>
      )}
      {canInvite && (
        <Card>
          <h2>Invitations</h2>
          {invitations.isPending ? (
            <LoadingState label="Loading invitations…" />
          ) : invitations.isError ? (
            <p role="alert">Could not load invitations.</p>
          ) : (
            <>
              <div className="tenant-table">
                <table>
                  <thead>
                    <tr>
                      <th>Email</th>
                      <th>Status</th>
                      <th>Expires</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invitations.data?.items.map((invitation) => (
                      <tr key={invitation.id}>
                        <td>{invitation.email}</td>
                        <td>
                          <Badge>{invitation.status}</Badge>
                        </td>
                        <td>{new Date(invitation.expiresAt).toLocaleDateString()}</td>
                        <td>
                          {invitation.status === 'pending' && (
                            <div className="tenant-actions">
                              <Button
                                disabled={busy}
                                onClick={() => {
                                  void perform(() =>
                                    tenantApi.manageInvitation(
                                      organizationId,
                                      invitation.id,
                                      'resend',
                                    ),
                                  )
                                }}
                              >
                                Resend
                              </Button>
                              <Button
                                disabled={busy}
                                onClick={() =>
                                  setConfirm({
                                    title: 'Revoke invitation?',
                                    description:
                                      'The current link will no longer grant membership.',
                                    operation: () =>
                                      tenantApi.manageInvitation(
                                        organizationId,
                                        invitation.id,
                                        'revoke',
                                      ),
                                  })
                                }
                              >
                                Revoke
                              </Button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!invitations.data?.items.length && (
                <p className="muted">No invitations yet. Invite someone when you are ready.</p>
              )}
              {invitations.data?.nextCursor && (
                <Button onClick={() => setInviteCursor(invitations.data!.nextCursor)}>
                  Next invitations
                </Button>
              )}
            </>
          )}
        </Card>
      )}
      {inviting && destinations.data && (
        <InviteDialog
          open
          close={() => setInviting(false)}
          organizationId={organizationId}
          canManageAdmins={canManageAdmins}
          companyScope={scope === 'organizations'}
          workspaces={destinations.data.items.filter(
            (workspace) =>
              workspace.status === 'active' && (!workspaceId || workspace.id === workspaceId),
          )}
        />
      )}
      {inviting && destinations.isError && (
        <p role="alert">Could not load authorized destinations. Try again.</p>
      )}
      <ConfirmationDialog
        open={!!confirm}
        onOpenChange={(open) => {
          if (!open) setConfirm(null)
        }}
        title={confirm?.title ?? 'Confirm change'}
        description={confirm?.description ?? ''}
        onConfirm={() => {
          if (confirm) void perform(confirm.operation)
        }}
      />
    </div>
  )
}
export default function TenantTeam() {
  const context = useWorkspace()
  return (
    <TeamDirectory
      scope="workspaces"
      organizationId={context.organization.id}
      workspaceId={context.workspace.id}
      permissions={context.permissions}
      role={context.role}
    />
  )
}
export function OrganizationTeam() {
  const { orgId = '' } = useParams(),
    { data: user } = useSession()
  const query = useQuery({
    queryKey: ['tenant', user?.id, orgId, 'organization'],
    queryFn: () => tenantApi.organization(orgId),
    retry: false,
    staleTime: 0,
    refetchOnMount: 'always',
  })
  if (query.isPending || (!query.isFetchedAfterMount && !query.isError))
    return <LoadingState label="Checking company access..." />
  if (query.isError)
    return (
      <TenantError
        error={query.error}
        retry={() => {
          void query.refetch()
        }}
      />
    )
  return (
    <main className="tenant-directory">
      <Link to={`/app/organizations/${orgId}/settings`}>Back to company settings</Link>
      <TeamDirectory
        scope="organizations"
        organizationId={orgId}
        permissions={query.data.permissions}
        role={query.data.role}
      />
    </main>
  )
}
