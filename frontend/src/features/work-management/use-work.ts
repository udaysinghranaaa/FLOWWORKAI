import { useQuery } from '@tanstack/react-query'
import { useSession } from '@/features/auth/use-session'
import { useWorkspace, useTenantRefresh } from '@/features/workspaces/use-tenant'
import { workApi } from '@/services/work-api'
export function useWorkScope() {
  const scope = useWorkspace(),
    { data: user } = useSession()
  return {
    scope,
    user,
    ws: scope.workspace.id,
    refresh: useTenantRefresh(),
    key: ['tenant', user?.id, scope.workspace.id, 'work'] as const,
  }
}
export const useWorkConfig = () =>
  useQuery({ queryKey: ['work-config'], queryFn: workApi.config, retry: false })
export const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'The change could not be completed.'
