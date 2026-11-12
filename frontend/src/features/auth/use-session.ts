import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api, ApiClientError } from '@/services/api-client'
import { clearInvitation } from '@/features/invitations/continuation'

export const sessionKey = ['auth', 'me'] as const
export function useSession() {
  return useQuery({
    queryKey: sessionKey,
    queryFn: async () => {
      try {
        return await api.currentUser()
      } catch (error) {
        if (error instanceof ApiClientError && error.status === 401) return null
        throw error
      }
    },
    retry: false,
    staleTime: 30000,
    refetchOnWindowFocus: true,
  })
}
export function useSignOut() {
  const client = useQueryClient()
  return async (all = false) => {
    await api.logout(all)
    clearInvitation()
    await client.cancelQueries()
    client.clear()
    client.setQueryData(sessionKey, null)
  }
}
