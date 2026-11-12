import { api } from './api-client'
export type Role = 'OWNER' | 'ADMIN' | 'MANAGER' | 'MEMBER' | 'VIEWER'
export interface Organization {
  id: string
  name: string
  slug: string
  description: string
  website: string
  industry: string
  status: 'active' | 'archived'
  version: number
  role: Role
  permissions: string[]
}
export interface Workspace {
  id: string
  organizationId: string
  name: string
  slug: string
  description: string
  status: 'active' | 'archived'
  version: number
  organizationName?: string
  role?: Role
}
export interface WorkspaceContext {
  organization: Organization
  workspace: Workspace
  organizationRole: Role
  role: Role
  permissions: string[]
  memberCount: number
  pendingInvitations: number | null
}
export interface Member {
  id: string
  userId: string
  name: string
  email: string
  role: Role
  status: string
  joinedAt: string
}
export interface Invitation {
  id: string
  organizationId: string
  email: string
  organizationRole: Role
  targets: { workspaceId: string; role: Role }[]
  status: string
  expiresAt: string
}
export interface Page<T> {
  items: T[]
  nextCursor: string | null
  hasMore: boolean
}
export interface CompanyInput {
  name: string
  slug: string
  description: string
  website: string
  industry: string
  workspaceName: string
  workspaceSlug: string
  creationKey: string
}
export interface InviteInput {
  email: string
  organizationRole: 'ADMIN' | 'MEMBER'
  targets: { workspaceId: string; role: Exclude<Role, 'OWNER'> }[]
  message: string
}
const page = (cursor?: string | null) =>
  `?limit=50${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`
export const tenantApi = {
  organizations: (cursor?: string | null) =>
    api.request<Page<Organization>>(`/organizations${page(cursor)}`),
  workspaces: (cursor?: string | null, organizationId?: string) =>
    api.request<Page<Workspace>>(
      `${organizationId ? `/organizations/${organizationId}/workspaces` : '/me/workspaces'}${page(cursor)}`,
    ),
  organization: (id: string) => api.request<Organization>(`/organizations/${id}`),
  workspace: (id: string, signal?: AbortSignal) =>
    api.request<WorkspaceContext>(`/workspaces/${id}`, signal ? { signal } : {}),
  createCompany: (body: CompanyInput) =>
    api.request<{ organization: Organization; workspace: Workspace }>('/organizations', {
      method: 'POST',
      body,
    }),
  createWorkspace: (
    orgId: string,
    body: { name: string; slug: string; description: string; creationKey: string },
  ) => api.request<Workspace>(`/organizations/${orgId}/workspaces`, { method: 'POST', body }),
  updateOrganization: (id: string, body: unknown) =>
    api.request<Organization>(`/organizations/${id}`, { method: 'PATCH', body }),
  updateWorkspace: (id: string, body: unknown) =>
    api.request<Workspace>(`/workspaces/${id}`, { method: 'PATCH', body }),
  members: (scope: 'organizations' | 'workspaces', id: string, cursor?: string | null) =>
    api.request<Page<Member>>(`/${scope}/${id}/members${page(cursor)}`),
  changeRole: (scope: 'organizations' | 'workspaces', id: string, memberId: string, role: Role) =>
    api.request(`/${scope}/${id}/members/${memberId}`, { method: 'PATCH', body: { role } }),
  removeMember: (scope: 'organizations' | 'workspaces', id: string, memberId: string) =>
    api.request(`/${scope}/${id}/members/${memberId}`, { method: 'DELETE' }),
  invitations: (scope: 'organizations' | 'workspaces', id: string, cursor?: string | null) =>
    api.request<Page<Invitation>>(`/${scope}/${id}/invitations${page(cursor)}`),
  invite: (orgId: string, body: InviteInput) =>
    api.request<Invitation>(`/organizations/${orgId}/invitations`, { method: 'POST', body }),
  manageInvitation: (orgId: string, id: string, action: 'resend' | 'revoke') =>
    api.request(`/organizations/${orgId}/invitations/${id}/${action}`, {
      method: 'POST',
      body: {},
    }),
  preview: (token: string) =>
    api.request<{
      organizationName: string
      workspaces: { name: string; role: Role }[]
      organizationRole: Role
      expiresAt: string
    }>('/invitations/preview', { method: 'POST', body: { token }, refresh: false }),
  accept: (token: string) =>
    api.request<{ organizationId: string; workspaceId: string }>('/invitations/accept', {
      method: 'POST',
      body: { token },
    }),
}
