import { useEffect, useState, type ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Tooltip } from 'radix-ui'
import { Toaster } from 'sonner'
import { DemoContext } from './demo-context'
import { createDemoRepository } from '@/services/demo-repository'
import { useUIStore } from '@/stores/ui-store'
import { ErrorBoundary } from '@/components/shared/error-boundary'

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false } },
      }),
  )
  const [repository] = useState(createDemoRepository)
  const theme = useUIStore((s) => s.theme)
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => {
      const resolved = theme === 'system' ? (media.matches ? 'dark' : 'light') : theme
      document.documentElement.classList.toggle('dark', resolved === 'dark')
      document.documentElement.dataset.theme = resolved
    }
    apply()
    media.addEventListener('change', apply)
    return () => media.removeEventListener('change', apply)
  }, [theme])
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <DemoContext.Provider value={repository}>
          <Tooltip.Provider delayDuration={250}>
            {children}
            <Toaster richColors position="bottom-right" closeButton theme={theme} />
          </Tooltip.Provider>
        </DemoContext.Provider>
      </QueryClientProvider>
    </ErrorBoundary>
  )
}
