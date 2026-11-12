import { api } from './api-client'
import type { Page } from './tenant-api'
export interface Client {
  id: string
  version: number
  name: string
  legalName: string
  type: string
  industry: string
  description: string
  website: string
  email: string
  phone: string
  country: string
  city: string
  address: string
  ownerId: string
  status: string
  tags: string[]
  allowRepresentatives: boolean
  archivedAt: string | null
}
export interface Contact {
  id: string
  version: number
  name: string
  email: string
  title: string
  phone: string
  role: string
  primary: boolean
  archivedAt: string | null
  portalAccess: boolean
}
export interface Grant {
  id: string
  version: number
  projectId: string
  title: string
  description: string
  status: string
  progress: boolean
  milestones: boolean
  deliverables: boolean
  feedback: boolean
  changes: boolean
  approve: boolean
}
export interface PortalMember {
  name?: string
  id: string
  version: number
  role: string
  status: string
  contactId?: string
  self?: boolean
}
export interface PortalInvite {
  id: string
  version: number
  contactId: string
  role: string
  status: string
  expiresAt: string
}
export interface ClientResource {
  canEdit?: boolean
  id: string
  version: number
  kind: string
  title: string
  body: string
  status: string
  published: boolean
  progress: number
  dueDate: string
  position: number
  priority: string
  parentId: string | null
  url: string
  fileName: string
  contentType: string
  size: number | null
  revision: number
  previousId: string | null
  decisionAt: string | null
  decisionNote: string
  publishedAt: string | null
  createdAt: string
  taskId?: string | null
}
export interface PortalIdentity {
  id: string
  name: string
  role: string
  allowRepresentatives?: boolean
}
export interface PortalDashboard {
  client: PortalIdentity
  sharedProjects: number
  pendingApprovals: number
  recentUpdates: ClientResource[]
  milestones: ClientResource[]
  recentFeedback: ClientResource[]
}
export const clientRoot = (ws: string) => `/workspaces/${ws}/clients`
export const clientPath = (ws: string, id: string) => `${clientRoot(ws)}/${id}`
export const portalPath = (id: string) => `/portal/clients/${id}`
export const clientApi = {
  get: <T>(path: string, signal?: AbortSignal) => api.request<T>(path, signal ? { signal } : {}),
  list: <T>(
    path: string,
    filters: Record<string, string | number | null | undefined> = {},
    signal?: AbortSignal,
  ) => {
    const q = new URLSearchParams()
    for (const [k, v] of Object.entries(filters))
      if (v !== undefined && v !== null && v !== '') q.set(k, String(v))
    return api.request<Page<T>>(path + (q.size ? '?' + q.toString() : ''), signal ? { signal } : {})
  },
  save: <T>(path: string, body: unknown, edit = false) =>
    api.request<T>(path, { method: edit ? 'PATCH' : 'POST', body }),
}
