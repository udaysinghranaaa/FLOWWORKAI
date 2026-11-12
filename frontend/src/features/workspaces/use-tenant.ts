import { useOutletContext } from 'react-router'
import { useQueryClient } from '@tanstack/react-query'
import { useSession } from '@/features/auth/use-session'
import type { WorkspaceContext } from '@/services/tenant-api'
export const useWorkspace = () => useOutletContext<WorkspaceContext>()
export function useTenantRefresh() {
  const client = useQueryClient(),
    { data: user } = useSession()
  return () => client.invalidateQueries({ queryKey: ['tenant', user?.id] })
}
