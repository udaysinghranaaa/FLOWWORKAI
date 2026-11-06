import type { ReactNode } from 'react'
import { ArrowUpRight, Inbox, AlertTriangle, Sparkles } from 'lucide-react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/display'

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string
  title: string
  description: string
  action?: ReactNode
}) {
  return (
    <header className="page-header">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1 tabIndex={-1}>{title}</h1>
        <p className="muted">{description}</p>
      </div>
      {action && <div className="page-actions">{action}</div>}
    </header>
  )
}
export function SectionHeading({
  title,
  subtitle,
  href,
  linkLabel = 'View all',
  action,
}: {
  title: string
  subtitle?: string
  href?: string
  linkLabel?: string
  action?: ReactNode
}) {
  return (
    <div className="section-heading">
      <div>
        <h2>{title}</h2>
        {subtitle && <p className="muted text-sm">{subtitle}</p>}
      </div>
      {href && (
        <Link className="text-link" to={href}>
          {linkLabel}
          <ArrowUpRight size={14} />
        </Link>
      )}
      {action}
    </div>
  )
}
export function EmptyState({
  title = 'Nothing here yet',
  description = 'New work starts with a little clarity.',
  action,
  icon,
}: {
  title?: string
  description?: string
  action?: ReactNode
  icon?: ReactNode
}) {
  return (
    <div className="empty-state">
      <div className="empty-icon">{icon ?? <Inbox size={23} />}</div>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  )
}
export function ErrorState({
  title = 'Something needs another look',
  description,
  onRetry,
}: {
  title?: string
  description: string
  onRetry?: () => void
}) {
  return (
    <div className="empty-state" role="alert">
      <AlertTriangle className="danger-text" size={28} />
      <h2>{title}</h2>
      <p>{description}</p>
      {onRetry && <Button onClick={onRetry}>Try again</Button>}
    </div>
  )
}
export function DemoLabel({ compact = false }: { compact?: boolean }) {
  return (
    <div className="demo-label">
      <span className="demo-dot" />
      <span>
        {compact ? 'Demo data' : 'Interactive demo · Fictional data · Changes reset on refresh'}
      </span>
    </div>
  )
}
export function IntegrationNotice({ children }: { children: ReactNode }) {
  return (
    <div className="integration-notice">
      <Sparkles size={17} aria-hidden="true" />
      <div>
        <Badge tone="violet">Frontend preview</Badge>
        <p>{children}</p>
      </div>
    </div>
  )
}
