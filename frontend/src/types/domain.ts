export type Role = 'Owner' | 'Admin' | 'Manager' | 'Member' | 'Client'
export type TaskStatus = 'backlog' | 'todo' | 'in_progress' | 'review' | 'done'
export type Priority = 'low' | 'normal' | 'high' | 'urgent'
export type ProjectStatus = 'planned' | 'active' | 'paused' | 'completed' | 'archived'
export type TicketStatus = 'open' | 'in_progress' | 'waiting_client' | 'resolved' | 'closed'
export interface Workspace {
  id: string
  name: string
  initials: string
  description: string
}
export interface Member {
  id: string
  workspaceId: string
  name: string
  email: string
  role: Role
  discipline: string
  status: 'active' | 'away'
  color: string
}
export interface Client {
  id: string
  workspaceId: string
  name: string
  contactName: string
  email: string
  website: string
  industry: string
  status: 'active' | 'archived'
  color: string
}
export interface Project {
  id: string
  workspaceId: string
  clientId: string
  name: string
  description: string
  status: ProjectStatus
  dueAt: string
  color: string
  memberIds: string[]
  clientVisible: boolean
  version: number
}
export interface Task {
  id: string
  workspaceId: string
  projectId: string
  title: string
  description: string
  publicSummary: string
  status: TaskStatus
  priority: Priority
  assigneeId: string
  dueAt: string
  clientVisible: boolean
  rank: number
  version: number
}
export interface Comment {
  id: string
  workspaceId: string
  taskId: string
  author: string
  body: string
  visibility: 'internal' | 'client'
  createdAt: string
}
export interface Milestone {
  id: string
  workspaceId: string
  projectId: string
  title: string
  dueAt: string
  status: 'planned' | 'in_progress' | 'delivered'
  clientVisible: boolean
  deliverable: string
}
export interface Ticket {
  id: string
  workspaceId: string
  clientId: string
  projectId: string
  number: number
  subject: string
  category: 'Design' | 'Technical' | 'Content' | 'General'
  status: TicketStatus
  priority: Priority
  assigneeId: string
  createdAt: string
  resolvedAt?: string
}
export interface TicketMessage {
  id: string
  workspaceId: string
  ticketId: string
  author: string
  body: string
  visibility: 'internal' | 'client'
  createdAt: string
}
export interface Notice {
  id: string
  workspaceId: string
  title: string
  description: string
  category: 'task' | 'project' | 'ticket'
  href: string
  read: boolean
  createdAt: string
}
export interface KnowledgeDocument {
  id: string
  workspaceId: string
  title: string
  category: string
  status: 'ready' | 'processing' | 'failed'
  content: string
  updatedAt: string
  pages: number
}
export interface Activity {
  id: string
  workspaceId: string
  actor: string
  action: string
  target: string
  createdAt: string
}
export interface Invitation {
  id: string
  workspaceId: string
  email: string
  role: Role
}
export interface DemoState {
  workspaces: Workspace[]
  members: Member[]
  clients: Client[]
  projects: Project[]
  tasks: Task[]
  comments: Comment[]
  milestones: Milestone[]
  tickets: Ticket[]
  messages: TicketMessage[]
  notifications: Notice[]
  documents: KnowledgeDocument[]
  activities: Activity[]
  invitations: Invitation[]
}
export const taskStatuses: TaskStatus[] = ['todo', 'in_progress', 'review', 'done']
export const taskLabels: Record<TaskStatus, string> = {
  backlog: 'Backlog',
  todo: 'To Do',
  in_progress: 'In Progress',
  review: 'In Review',
  done: 'Done',
}
export const ticketLabels: Record<TicketStatus, string> = {
  open: 'Open',
  in_progress: 'In Progress',
  waiting_client: 'Pending',
  resolved: 'Resolved',
  closed: 'Closed',
}
export const priorities: Priority[] = ['low', 'normal', 'high', 'urgent']
