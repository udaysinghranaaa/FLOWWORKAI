import { Navigate, Outlet } from 'react-router'
import { LoadingState } from '@/components/ui/display'
import { ErrorState } from '@/components/shared/page'
import { useSession } from './use-session'

export default function ProtectedRoute() {
  const session = useSession()
  if (session.isPending) return <LoadingState label="Checking your session…" />
  if (session.isError)
    return (
      <main className="standalone">
        <ErrorState
          title="Cannot check your session"
          description="Your private account stays hidden until the server confirms your session."
          onRetry={() => {
            void session.refetch()
          }}
        />
      </main>
    )
  if (!session.data) return <Navigate to="/login" replace />
  return <Outlet />
}
