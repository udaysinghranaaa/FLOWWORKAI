import { createFixtures, DEMO_NOW } from '@/mocks/fixtures'
import type {
  DemoState,
  Project,
  Task,
  Client,
  Ticket,
  TicketMessage,
  Comment,
  Invitation,
  Workspace,
} from '@/types/domain'

type NewEntity<T> = Omit<T, 'id'>
export interface DemoRepository {
  getSnapshot: () => DemoState
  subscribe: (listener: () => void) => () => void
  reset: () => void
  saveProject: (input: Omit<Project, 'id' | 'version'>, id?: string) => Project
  saveTask: (input: Omit<Task, 'id' | 'version' | 'rank'>, id?: string) => Task
  updateTask: (
    workspaceId: string,
    id: string,
    patch: Partial<Pick<Task, 'status' | 'assigneeId' | 'rank'>>,
  ) => void
  saveClient: (input: NewEntity<Client>, id?: string) => Client
  createTicket: (input: Omit<Ticket, 'id' | 'number' | 'createdAt'>, body: string) => Ticket
  updateTicket: (
    workspaceId: string,
    id: string,
    patch: Partial<Pick<Ticket, 'status' | 'assigneeId' | 'priority'>>,
  ) => void
  addMessage: (input: Omit<TicketMessage, 'id' | 'createdAt'>) => void
  addComment: (input: Omit<Comment, 'id' | 'createdAt'>) => void
  markRead: (workspaceId: string, id?: string) => void
  invite: (input: NewEntity<Invitation>) => void
  updateWorkspace: (id: string, patch: Pick<Workspace, 'name' | 'description'>) => void
}

/** Browser-memory demo adapter. No network, persistence, authentication or security boundary. */
export function createDemoRepository(): DemoRepository {
  let state = createFixtures()
  let sequence = 200
  const listeners = new Set<() => void>()
  const emit = (next: DemoState) => {
    state = next
    listeners.forEach((fn) => fn())
  }
  const id = (prefix: string) => `${prefix}-${++sequence}`
  const requireWorkspace = (w: string) => {
    if (!state.workspaces.some((x) => x.id === w)) throw new Error('Demo workspace not found.')
  }
  const requireProject = (w: string, p: string) => {
    if (!state.projects.some((x) => x.id === p && x.workspaceId === w))
      throw new Error('Choose a project in this demo workspace.')
  }
  const validateAssignee = (w: string, memberId: string, projectId?: string) => {
    if (!memberId) return
    const member = state.members.find(
      (x) => x.id === memberId && x.workspaceId === w && x.role !== 'Client',
    )
    if (!member) throw new Error('Choose an internal demo teammate.')
    const project = state.projects.find((x) => x.id === projectId && x.workspaceId === w)
    if (
      project &&
      !project.memberIds.includes(memberId) &&
      !['Owner', 'Admin'].includes(member.role)
    )
      throw new Error('The assignee must belong to this project.')
  }
  return {
    getSnapshot: () => state,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    reset: () => {
      sequence = 200
      emit(createFixtures())
    },
    saveProject: (input, existingId) => {
      requireWorkspace(input.workspaceId)
      if (
        input.clientId &&
        !state.clients.some((x) => x.id === input.clientId && x.workspaceId === input.workspaceId)
      )
        throw new Error('Choose a client in this workspace.')
      if (
        input.memberIds.some(
          (m) =>
            !state.members.some(
              (x) => x.id === m && x.workspaceId === input.workspaceId && x.role !== 'Client',
            ),
        )
      )
        throw new Error('Project members must be internal demo teammates.')
      const previous = existingId
        ? state.projects.find((x) => x.id === existingId && x.workspaceId === input.workspaceId)
        : undefined
      if (existingId && !previous) throw new Error('Project no longer exists in this workspace.')
      if (
        previous &&
        previous.clientId !== input.clientId &&
        (previous.clientVisible ||
          state.tasks.some((task) => task.projectId === previous.id && task.clientVisible))
      ) {
        throw new Error('A published demo project cannot be moved to a different client.')
      }
      const assignedMembers = state.tasks
        .filter((task) => task.projectId === previous?.id && task.assigneeId)
        .map((task) => task.assigneeId)
      if (
        assignedMembers.some(
          (memberId) =>
            !input.memberIds.includes(memberId) &&
            !state.members.some(
              (member) => member.id === memberId && ['Owner', 'Admin'].includes(member.role),
            ),
        )
      ) {
        throw new Error(
          'Reassign open project tasks before removing their teammate from the project.',
        )
      }
      const project: Project = {
        ...input,
        id: existingId ?? id('project'),
        version: (previous?.version ?? 0) + 1,
      }
      emit({
        ...state,
        projects: previous
          ? state.projects.map((x) => (x.id === project.id ? project : x))
          : [...state.projects, project],
      })
      return project
    },
    saveTask: (input, existingId) => {
      requireProject(input.workspaceId, input.projectId)
      validateAssignee(input.workspaceId, input.assigneeId, input.projectId)
      const previous = existingId
        ? state.tasks.find((x) => x.id === existingId && x.workspaceId === input.workspaceId)
        : undefined
      if (existingId && !previous) throw new Error('Task no longer exists in this workspace.')
      const task: Task = {
        ...input,
        id: existingId ?? id('FW'),
        version: (previous?.version ?? 0) + 1,
        rank: previous?.rank ?? sequence,
      }
      emit({
        ...state,
        tasks: previous
          ? state.tasks.map((x) => (x.id === task.id ? task : x))
          : [...state.tasks, task],
      })
      return task
    },
    updateTask: (w, taskId, patch) => {
      const task = state.tasks.find((x) => x.id === taskId && x.workspaceId === w)
      if (!task) throw new Error('Task not found in this workspace.')
      validateAssignee(w, patch.assigneeId ?? task.assigneeId, task.projectId)
      emit({
        ...state,
        tasks: state.tasks.map((x) =>
          x.id === taskId ? { ...x, ...patch, version: x.version + 1 } : x,
        ),
      })
    },
    saveClient: (input, existingId) => {
      requireWorkspace(input.workspaceId)
      if (
        existingId &&
        !state.clients.some((x) => x.id === existingId && x.workspaceId === input.workspaceId)
      )
        throw new Error('Client not found in this workspace.')
      const client: Client = { ...input, id: existingId ?? id('client') }
      emit({
        ...state,
        clients: existingId
          ? state.clients.map((x) => (x.id === existingId ? client : x))
          : [...state.clients, client],
      })
      return client
    },
    createTicket: (input, body) => {
      requireWorkspace(input.workspaceId)
      if (
        !state.clients.some((c) => c.id === input.clientId && c.workspaceId === input.workspaceId)
      )
        throw new Error('Choose a client in this workspace.')
      if (input.projectId) {
        requireProject(input.workspaceId, input.projectId)
        if (!state.projects.some((p) => p.id === input.projectId && p.clientId === input.clientId))
          throw new Error('Project must belong to this client.')
      }
      validateAssignee(input.workspaceId, input.assigneeId)
      const ticket: Ticket = {
        ...input,
        id: id('ticket'),
        number:
          Math.max(
            1000,
            ...state.tickets
              .filter((x) => x.workspaceId === input.workspaceId)
              .map((x) => x.number),
          ) + 1,
        createdAt: DEMO_NOW,
      }
      const message: TicketMessage = {
        id: id('message'),
        workspaceId: input.workspaceId,
        ticketId: ticket.id,
        author: 'Demo visitor',
        body,
        visibility: 'client',
        createdAt: DEMO_NOW,
      }
      emit({
        ...state,
        tickets: [ticket, ...state.tickets],
        messages: [...state.messages, message],
      })
      return ticket
    },
    updateTicket: (w, ticketId, patch) => {
      if (!state.tickets.some((x) => x.id === ticketId && x.workspaceId === w))
        throw new Error('Ticket not found in this workspace.')
      validateAssignee(w, patch.assigneeId ?? '')
      emit({
        ...state,
        tickets: state.tickets.map((x) =>
          x.id === ticketId
            ? {
                ...x,
                ...patch,
                ...((patch.status === 'resolved' || patch.status === 'closed') && !x.resolvedAt
                  ? { resolvedAt: DEMO_NOW }
                  : {}),
                ...(patch.status === 'open' ||
                patch.status === 'in_progress' ||
                patch.status === 'waiting_client'
                  ? { resolvedAt: undefined }
                  : {}),
              }
            : x,
        ),
      })
    },
    addMessage: (input) => {
      if (
        !state.tickets.some((x) => x.id === input.ticketId && x.workspaceId === input.workspaceId)
      )
        throw new Error('Ticket no longer exists.')
      emit({
        ...state,
        messages: [...state.messages, { ...input, id: id('message'), createdAt: DEMO_NOW }],
      })
    },
    addComment: (input) => {
      if (!state.tasks.some((x) => x.id === input.taskId && x.workspaceId === input.workspaceId))
        throw new Error('Task no longer exists.')
      emit({
        ...state,
        comments: [...state.comments, { ...input, id: id('comment'), createdAt: DEMO_NOW }],
      })
    },
    markRead: (w, noticeId) =>
      emit({
        ...state,
        notifications: state.notifications.map((x) =>
          x.workspaceId === w && (!noticeId || x.id === noticeId) ? { ...x, read: true } : x,
        ),
      }),
    invite: (input) => {
      requireWorkspace(input.workspaceId)
      if (
        state.invitations.some(
          (x) =>
            x.workspaceId === input.workspaceId &&
            x.email.toLowerCase() === input.email.toLowerCase(),
        )
      )
        throw new Error('This address already has a demo invitation.')
      emit({ ...state, invitations: [...state.invitations, { ...input, id: id('invite') }] })
    },
    updateWorkspace: (workspaceId, patch) => {
      requireWorkspace(workspaceId)
      emit({
        ...state,
        workspaces: state.workspaces.map((x) => (x.id === workspaceId ? { ...x, ...patch } : x)),
      })
    },
  }
}
