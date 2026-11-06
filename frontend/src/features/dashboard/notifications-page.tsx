import { useState } from 'react'
import { Link } from 'react-router'
import { Bell, CheckCheck, ArrowUpRight } from 'lucide-react'
import { useDemo } from '@/hooks/use-demo'
import { PageHeader, EmptyState } from '@/components/shared/page'
import { Button } from '@/components/ui/button'
import { Badge, Card } from '@/components/ui/display'
import { Select } from '@/components/ui/fields'
import { formatDate, cn } from '@/lib/utils'

export default function NotificationsPage({ portal = false }: { portal?: boolean }) {
  const { notices, repository, workspaceId, base } = useDemo()
  const [filter, setFilter] = useState('all')
  // Separate public-safe preview projection; never render the internal task notification in the portal.
  const visible = portal ? notices.filter((n) => n.id === 'n-3') : notices
  const filtered = visible.filter(
    (n) => filter === 'all' || (filter === 'unread' ? !n.read : n.category === filter),
  )
  return (
    <>
      <PageHeader
        title={portal ? 'Project updates' : 'Notifications'}
        description="A quieter place to catch up. Sample events, with no live delivery."
        action={
          <Button onClick={() => visible.forEach((n) => repository.markRead(workspaceId, n.id))}>
            <CheckCheck size={16} />
            Mark all as read
          </Button>
        }
      />
      <div className="filter-bar">
        <Select
          aria-label="Filter notifications"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="all">All updates</option>
          <option value="unread">Unread only</option>
          <option value="task">Tasks</option>
          <option value="project">Projects</option>
          <option value="ticket">Support</option>
        </Select>
        <Badge tone="violet">{visible.filter((n) => !n.read).length} unread</Badge>
      </div>
      <Card className="notification-list">
        {filtered.map((n) => (
          <article className={cn('notification-row', !n.read && 'unread')} key={n.id}>
            <div className="metric-icon avatar-violet">
              <Bell size={18} />
            </div>
            <div>
              <Link
                to={portal ? `${base}/portal/projects/p-orbit` : n.href}
                onClick={() => repository.markRead(workspaceId, n.id)}
              >
                <h2>
                  {n.title}
                  <ArrowUpRight size={14} />
                </h2>
              </Link>
              <p className="muted">{n.description}</p>
              <time dateTime={n.createdAt}>
                {formatDate(n.createdAt)} · {n.category}
              </time>
            </div>
            {!n.read && (
              <Button
                size="small"
                variant="ghost"
                onClick={() => repository.markRead(workspaceId, n.id)}
              >
                Mark read
              </Button>
            )}
          </article>
        ))}
        {!filtered.length && (
          <EmptyState
            title="You’re all caught up"
            description="No notifications match this view."
            icon={<Bell size={24} />}
          />
        )}
      </Card>
    </>
  )
}
