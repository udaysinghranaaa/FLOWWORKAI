import type { ReactNode, ComponentProps } from 'react'
import { Tabs as TabsPrimitive, Avatar as AvatarPrimitive } from 'radix-ui'
import { ChevronLeft, ChevronRight, Loader2, Circle } from 'lucide-react'
import { Link } from 'react-router'
import { cn, initials } from '@/lib/utils'
import { Button } from './button'
import {
  taskLabels,
  ticketLabels,
  type TaskStatus,
  type TicketStatus,
  type Priority,
} from '@/types/domain'

export function Card({ children, className, ...props }: ComponentProps<'section'>) {
  return (
    <section className={cn('card', className)} {...props}>
      {children}
    </section>
  )
}
export function Badge({
  children,
  tone = 'neutral',
  className,
}: {
  children: ReactNode
  tone?: string
  className?: string
}) {
  return <span className={cn('badge', `tone-${tone}`, className)}>{children}</span>
}
export function StatusIndicator({ status, ticket = false }: { status: string; ticket?: boolean }) {
  const label = ticket ? ticketLabels[status as TicketStatus] : taskLabels[status as TaskStatus]
  return (
    <Badge
      tone={
        status === 'done' ||
        status === 'completed' ||
        status === 'resolved' ||
        status === 'delivered'
          ? 'green'
          : status === 'review' || status === 'waiting_client' || status === 'paused'
            ? 'amber'
            : status === 'active' || status === 'in_progress'
              ? 'violet'
              : 'neutral'
      }
    >
      <Circle size={8} fill="currentColor" aria-hidden="true" />
      {label ?? status.replaceAll('_', ' ')}
    </Badge>
  )
}
export function PriorityBadge({ priority }: { priority: Priority }) {
  return (
    <span className={cn('priority', `priority-${priority}`)}>
      <span aria-hidden="true">
        {priority === 'urgent'
          ? '▰'
          : priority === 'high'
            ? '▥'
            : priority === 'normal'
              ? '▤'
              : '▱'}
      </span>
      {priority === 'normal' ? 'Normal' : priority[0].toUpperCase() + priority.slice(1)}
    </span>
  )
}
export function Avatar({
  name,
  color = 'violet',
  size = 'default',
}: {
  name: string
  color?: string
  size?: 'small' | 'default' | 'large'
}) {
  return (
    <AvatarPrimitive.Root
      className={cn('avatar', `avatar-${size}`, `avatar-${color}`)}
      title={name}
    >
      <AvatarPrimitive.Fallback>{initials(name)}</AvatarPrimitive.Fallback>
    </AvatarPrimitive.Root>
  )
}
export function Progress({ value, label = 'Completion' }: { value: number; label?: string }) {
  return (
    <div
      className="progress-track"
      role="progressbar"
      aria-label={label}
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  )
}
export function Tabs({
  value,
  onValueChange,
  items,
}: {
  value: string
  onValueChange: (value: string) => void
  items: { value: string; label: string; content: ReactNode }[]
}) {
  return (
    <TabsPrimitive.Root value={value} onValueChange={onValueChange}>
      <TabsPrimitive.List className="tabs" aria-label="Section">
        {items.map((x) => (
          <TabsPrimitive.Trigger className="tab" key={x.value} value={x.value}>
            {x.label}
          </TabsPrimitive.Trigger>
        ))}
      </TabsPrimitive.List>
      {items.map((x) => (
        <TabsPrimitive.Content key={x.value} value={x.value} className="tab-panel">
          {x.content}
        </TabsPrimitive.Content>
      ))}
    </TabsPrimitive.Root>
  )
}
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn('skeleton', className)} />
}
export function LoadingState({ label = 'Loading workspace…' }: { label?: string }) {
  return (
    <div className="loading-state" role="status">
      <Loader2 className="spin" size={24} />
      <p>{label}</p>
      <Skeleton />
      <Skeleton />
    </div>
  )
}
export function Breadcrumb({ items }: { items: { label: string; href?: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="breadcrumb">
      <ol>
        {items.map((x, i) => (
          <li key={`${x.label}-${i}`}>
            {i > 0 && <ChevronRight size={12} aria-hidden="true" />}
            {x.href ? (
              <Link to={x.href}>{x.label}</Link>
            ) : (
              <span aria-current={i === items.length - 1 ? 'page' : undefined}>{x.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}
export function Table<T>({
  columns,
  rows,
  getKey,
  caption,
}: {
  columns: { label: string; render: (row: T) => ReactNode; className?: string }[]
  rows: T[]
  getKey: (row: T) => string
  caption: string
}) {
  return (
    <div className="table-scroll" role="region" aria-label={caption} tabIndex={0}>
      <table>
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.label} scope="col" className={c.className}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={getKey(row)}>
              {columns.map((c) => (
                <td key={c.label} className={c.className}>
                  {c.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
export function Pagination({
  page,
  total,
  pageSize,
  onChange,
}: {
  page: number
  total: number
  pageSize: number
  onChange: (page: number) => void
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  return (
    <div className="pagination">
      <span className="muted">
        {total
          ? `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} of ${total}`
          : '0 results'}
      </span>
      <div>
        <Button
          size="small"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
          aria-label="Previous page"
        >
          <ChevronLeft size={16} />
        </Button>
        <span>
          Page {page} of {pages}
        </span>
        <Button
          size="small"
          disabled={page >= pages}
          onClick={() => onChange(page + 1)}
          aria-label="Next page"
        >
          <ChevronRight size={16} />
        </Button>
      </div>
    </div>
  )
}
