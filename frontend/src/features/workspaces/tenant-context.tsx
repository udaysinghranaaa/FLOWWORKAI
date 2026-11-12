import { useEffect, useRef } from 'react'
import { Link } from 'react-router'
import { ErrorState } from '@/components/shared/page'
export function TenantHeading({ children }: { children: string }) {
  const ref = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    ref.current?.focus()
  }, [])
  return (
    <h1 ref={ref} tabIndex={-1}>
      {children}
    </h1>
  )
}
export function TenantError({ error, retry }: { error: unknown; retry: () => void }) {
  return (
    <div className="tenant-page">
      <ErrorState
        title="Workspace access unavailable"
        description={
          error instanceof Error ? error.message : 'The server could not confirm access.'
        }
        onRetry={retry}
      />
      <Link to="/app/workspaces">Choose an authorized workspace</Link>
    </div>
  )
}
