import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useSession } from '@/features/auth/use-session'
import { clientApi } from '@/services/client-api'
export function useClientQuery<T>(path: string) {
  const { data: user } = useSession()
  return useQuery({
    queryKey: ['clients', user?.id, path],
    queryFn: ({ signal }) => clientApi.get<T>(path, signal),
    retry: false,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchInterval: 10000,
  })
}
export function useClientRefresh() {
  const cache = useQueryClient()
  return () => cache.invalidateQueries({ queryKey: ['clients'] })
}
export const options = (values: readonly string[]) =>
  values.map((value) => ({ value, label: value.replaceAll('_', ' ') }))
