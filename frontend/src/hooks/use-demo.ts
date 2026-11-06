import { useContext, useSyncExternalStore } from 'react'
import { useParams } from 'react-router'
import { DemoContext } from '@/app/demo-context'

export function useDemo() {
  const repository = useContext(DemoContext)
  if (!repository) throw new Error('DemoProvider is required.')
  const state = useSyncExternalStore(repository.subscribe, repository.getSnapshot)
  const { workspaceId = 'studio' } = useParams()
  return {
    state,
    repository,
    workspaceId,
    workspace: state.workspaces.find((x) => x.id === workspaceId),
    projects: state.projects.filter((x) => x.workspaceId === workspaceId),
    tasks: state.tasks.filter((x) => x.workspaceId === workspaceId),
    members: state.members.filter((x) => x.workspaceId === workspaceId),
    clients: state.clients.filter((x) => x.workspaceId === workspaceId),
    tickets: state.tickets.filter((x) => x.workspaceId === workspaceId),
    notices: state.notifications.filter((x) => x.workspaceId === workspaceId),
    base: `/w/${workspaceId}`,
  }
}
