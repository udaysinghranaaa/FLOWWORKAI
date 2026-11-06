import { Suspense, useEffect } from 'react'
import { Link, Outlet, useLocation } from 'react-router'
import { LoadingState } from '@/components/ui/display'
import { ErrorState } from '@/components/shared/page'
import { Button } from '@/components/ui/button'
import { paths } from './paths'

export function NotFound() {
  return (
    <main className="not-found">
      <p className="eyebrow">404 · A SMALL DETOUR</p>
      <h1>This page took a different path.</h1>
      <p className="muted">Let’s find your way back to something useful.</p>
      <Button asChild variant="primary">
        <Link to={paths.home}>Back to FlowWork AI</Link>
      </Button>
      <Button asChild>
        <Link to={paths.demo}>Explore the workspace</Link>
      </Button>
    </main>
  )
}
export function RouteError() {
  return (
    <main className="standalone">
      <ErrorState
        title="This page couldn’t load"
        description="Try reloading the frontend. Refreshing restores the original demo records."
        onRetry={() => window.location.reload()}
      />
    </main>
  )
}
export function RouteFrame() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })
    document.title = `${pathname === '/' ? 'One workspace. Every workflow.' : pathname.split('/').filter(Boolean).slice(-1)[0]?.replaceAll('-', ' ')} · FlowWork AI`
    const frame = requestAnimationFrame(() =>
      document.querySelector<HTMLElement>('main h1')?.focus({ preventScroll: true }),
    )
    return () => cancelAnimationFrame(frame)
  }, [pathname])
  return (
    <Suspense fallback={<LoadingState label="Opening FlowWork AI…" />}>
      <Outlet />
    </Suspense>
  )
}
