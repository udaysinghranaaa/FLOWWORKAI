import { api } from './api-client'
import type { Page } from './tenant-api'
export interface Option {
  value: string
  label: string
}
export interface WorkConfig {
  projectStatuses: Option[]
  taskStatuses: Option[]
  priorities: Option[]
  defaults: { projectStatus: string; taskStatus: string; priority: string }
  colors: string[]
}
export interface Person {
  id: string
  name: string
}
export interface Capabilities {
  read: boolean
  manage: boolean
  contribute: boolean
  moderate: boolean
}
export interface WorkProject {
  id: string
  organizationId: string
  workspaceId: string
  name: string
  slug: string
  description: string
  ownerUserId: string
  owner?: Person
  createdBy: string
  status: string
  previousStatus: string
  priority: string
  color: string
  startDate: string | null
  dueDate: string | null
  version: number
  createdAt: string
  updatedAt: string
  totalTasks?: number
  completedTasks?: number
  permissions?: Capabilities
  members?: Person[]
  memberCount?: number
}
export interface WorkTask {
  id: string
  projectId: string
  workspaceId: string
  title: string
  description: string
  status: string
  priority: string
  assigneeId: string | null
  assigneeEligible?: boolean
  assignee?: Person | null
  reporter?: Person
  createdBy: string
  parentTaskId: string | null
  labels: string[]
  startDate: string | null
  dueDate: string | null
  completedAt: string | null
  archivedAt: string | null
  position: number
  version: number
  createdAt: string
  updatedAt: string
  permissions?: Capabilities
  subtasks?: { total: number; done: number }
  canEdit?: boolean
  projectName?: string
}
export interface WorkMember {
  id: string
  userId: string
  name: string
  role: string
  eligible?: boolean
}
export interface WorkComment {
  id: string
  authorId: string
  author?: Person
  text: string
  version: number
  createdAt: string
  updatedAt: string
}
export interface Activity {
  id: string
  taskId: string | null
  actor?: Person
  action: string
  metadata: { fields?: string[]; from?: string; to?: string }
  createdAt: string
}
export interface BoardColumn {
  status: string
  items: WorkTask[]
  total: number
  nextCursor: number | null
}
export interface Board {
  version: number
  readOnly: boolean
  columns: BoardColumn[]
}
export interface Dashboard {
  totalProjects: number
  activeProjects: number
  tasks: {
    total: number
    todo: number
    inProgress: number
    done: number
    overdue: number
    mine: number
  }
  upcoming: WorkTask[]
  recentProjects: Pick<WorkProject, 'id' | 'name' | 'status' | 'updatedAt'>[]
}
export type Filters = Record<string, string | number | undefined | null>
const query = (filters: Filters = {}) => {
  const q = new URLSearchParams()
  for (const [key, value] of Object.entries(filters))
    if (value !== undefined && value !== null && value !== '') q.set(key, String(value))
  return q.size ? '?' + q.toString() : ''
}
const workspace = (ws: string) => `/workspaces/${ws}`
const project = (ws: string, p: string) => `${workspace(ws)}/projects/${p}`
const task = (ws: string, p: string, t: string) => `${project(ws, p)}/tasks/${t}`
export const workApi = {
  config: () => api.request<WorkConfig>('/work-management/config'),
  projects: (ws: string, filters: Filters = {}, signal?: AbortSignal) =>
    api.request<Page<WorkProject>>(
      `${workspace(ws)}/projects${query(filters)}`,
      signal ? { signal } : {},
    ),
  project: (ws: string, p: string, signal?: AbortSignal) =>
    api.request<WorkProject>(project(ws, p), signal ? { signal } : {}),
  createProject: (ws: string, body: unknown) =>
    api.request<WorkProject>(`${workspace(ws)}/projects`, { method: 'POST', body }),
  updateProject: (ws: string, p: string, body: unknown) =>
    api.request<WorkProject>(project(ws, p), { method: 'PATCH', body }),
  members: (ws: string, p: string, filters: Filters = {}) =>
    api.request<Page<WorkMember>>(`${project(ws, p)}/members${query(filters)}`),
  member: (ws: string, p: string, body: unknown) =>
    api.request(`${project(ws, p)}/members`, { method: 'POST', body }),
  removeMember: (ws: string, p: string, userId: string, version: number) =>
    api.request(`${project(ws, p)}/members/${userId}`, { method: 'DELETE', body: { version } }),
  tasks: (ws: string, filters: Filters = {}, p?: string, signal?: AbortSignal) =>
    api.request<Page<WorkTask>>(
      `${p ? project(ws, p) : workspace(ws)}/tasks${query(filters)}`,
      signal ? { signal } : {},
    ),
  task: (ws: string, p: string, t: string, signal?: AbortSignal) =>
    api.request<WorkTask>(task(ws, p, t), signal ? { signal } : {}),
  createTask: (ws: string, p: string, body: unknown) =>
    api.request<WorkTask>(`${project(ws, p)}/tasks`, { method: 'POST', body }),
  updateTask: (ws: string, p: string, t: string, body: unknown) =>
    api.request<WorkTask>(task(ws, p, t), { method: 'PATCH', body }),
  board: (ws: string, p: string, filters: Filters = {}, signal?: AbortSignal) =>
    api.request<Board>(`${project(ws, p)}/board${query(filters)}`, signal ? { signal } : {}),
  move: (ws: string, p: string, t: string, body: unknown) =>
    api.request<WorkTask>(`${task(ws, p, t)}/move`, { method: 'PATCH', body }),
  comments: (ws: string, p: string, t: string, filters: Filters = {}) =>
    api.request<Page<WorkComment>>(`${task(ws, p, t)}/comments${query(filters)}`),
  comment: (ws: string, p: string, t: string, body: unknown, id?: string, remove = false) =>
    api.request(`${task(ws, p, t)}/comments${id ? '/' + id : ''}`, {
      method: remove ? 'DELETE' : id ? 'PATCH' : 'POST',
      body,
    }),
  activity: (ws: string, p: string, filters: Filters = {}, t?: string) =>
    api.request<Page<Activity>>(`${t ? task(ws, p, t) : project(ws, p)}/activity${query(filters)}`),
  dashboard: (ws: string, signal?: AbortSignal) =>
    api.request<Dashboard>(`${workspace(ws)}/dashboard`, signal ? { signal } : {}),
}
