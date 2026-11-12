import type { OrganizationRole, WorkspaceRole } from './membership.models.js'
export const organizationPermissions = [
  'organization.read',
  'organization.update',
  'organization.members.read',
  'organization.members.manage',
  'organization.invitations.manage',
  'workspace.create',
] as const
export const workspacePermissions = [
  'workspace.read',
  'workspace.update',
  'workspace.members.read',
  'workspace.members.manage',
  'workspace.invitations.manage',
] as const
export type Permission =
  (typeof organizationPermissions)[number] | (typeof workspacePermissions)[number]
export const permissionMatrix: Record<OrganizationRole, readonly Permission[]> = {
  OWNER: [...organizationPermissions, ...workspacePermissions],
  ADMIN: [...organizationPermissions, ...workspacePermissions],
  MEMBER: ['organization.read'],
}
export const workspacePermissionMatrix: Record<WorkspaceRole, readonly Permission[]> = {
  OWNER: [...workspacePermissions],
  ADMIN: [...workspacePermissions],
  MANAGER: ['workspace.read', 'workspace.members.read'],
  MEMBER: ['workspace.read', 'workspace.members.read'],
  VIEWER: ['workspace.read', 'workspace.members.read'],
}

/** Phase 6 project capabilities narrow existing live workspace authority. */
export function projectCapabilities(
  workspaceRole: WorkspaceRole,
  grant: string | undefined,
  owner = false,
) {
  const admin = workspaceRole === 'OWNER' || workspaceRole === 'ADMIN'
  const readable = admin || !!grant || owner
  const manage = admin || (workspaceRole === 'MANAGER' && (grant === 'MANAGER' || owner))
  const contribute = manage || (workspaceRole !== 'VIEWER' && grant === 'CONTRIBUTOR')
  return { read: readable, manage, contribute, moderate: manage }
}
export const canCreateProject = (role: WorkspaceRole) =>
  ['OWNER', 'ADMIN', 'MANAGER'].includes(role)
