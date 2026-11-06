import { useState } from 'react'
import { BarChart3, Download } from 'lucide-react'
import { useDemo } from '@/hooks/use-demo'
import { progress } from '@/lib/utils'
import { PageHeader, SectionHeading, EmptyState } from '@/components/shared/page'
import { Card, Badge, Progress, Table } from '@/components/ui/display'
import { Select } from '@/components/ui/fields'
import { Button } from '@/components/ui/button'
import { CompletionChart, WorkloadChart, StatusDistribution } from '@/components/charts/work-charts'
import { priorities } from '@/types/domain'
import { DEMO_NOW } from '@/mocks/fixtures'

export default function AnalyticsPage() {
  const { tasks, projects, tickets, members } = useDemo()
  const [range, setRange] = useState('month')
  const start = range === 'week' ? '2026-11-01' : range === 'next' ? '2026-11-07' : '2026-11-01'
  const end = range === 'week' ? '2026-11-07' : range === 'next' ? '2026-11-14' : '2026-11-30'
  const selected = tasks.filter((t) => t.dueAt >= start && t.dueAt <= end)
  const selectedTickets = tickets.filter(
    (t) => t.createdAt.slice(0, 10) >= start && t.createdAt.slice(0, 10) <= end,
  )
  const resolved = selectedTickets.filter((t) => !!t.resolvedAt)
  const resolutionHours = resolved.length
    ? Math.round(
        resolved.reduce(
          (n, t) =>
            n + (new Date(t.resolvedAt!).getTime() - new Date(t.createdAt).getTime()) / 3600000,
          0,
        ) / resolved.length,
      )
    : null
  const exportSummary = () => {
    const csv = `Metric,Value\nTasks due,${selected.length}\nCurrently complete,${selected.filter((t) => t.status === 'done').length}\nCompletion percent,${progress(selected)}\nTickets opened,${selectedTickets.length}\n`
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'flowwork-demo-summary.csv'
    anchor.click()
    URL.revokeObjectURL(url)
  }
  return (
    <>
      <PageHeader
        eyebrow="CLARITY OVER GUESSWORK"
        title="Workspace analytics"
        description="A thoughtful look at delivery, workload, and the conversations behind it."
        action={
          <>
            <Select
              aria-label="Analytics date range"
              value={range}
              onChange={(e) => setRange(e.target.value)}
            >
              <option value="month">November 2026</option>
              <option value="week">Nov 1–7</option>
              <option value="next">Nov 7–14</option>
            </Select>
            <Button onClick={exportSummary}>
              <Download size={15} />
              Export demo CSV
            </Button>
          </>
        }
      />
      <div className="analytics-note">
        <Badge tone="violet">Sample metrics</Badge>
        <span>
          Tasks filtered by due date; tickets by opened date. Snapshot:{' '}
          {new Date(DEMO_NOW).toLocaleDateString('en-GB', { timeZone: 'UTC' })}.
        </span>
      </div>
      <div className="metrics-grid">
        {[
          {
            title: 'Tasks due in range',
            value: selected.length,
            label: 'From the current demo records',
          },
          {
            title: 'Currently complete',
            value: `${progress(selected)}%`,
            label: 'Current status, not historical velocity',
          },
          {
            title: 'Tickets opened',
            value: selectedTickets.length,
            label: `${resolved.length} resolved or closed`,
          },
          {
            title: 'Avg. resolution',
            value: resolutionHours === null ? '—' : `${resolutionHours}h`,
            label: resolved.length
              ? `${resolved.length} resolved cases in range`
              : 'No resolved cases in range',
          },
        ].map((m) => (
          <Card className="metric-card" key={m.title}>
            <span>{m.title}</span>
            <strong>{m.value}</strong>
            <p>{m.label}</p>
          </Card>
        ))}
      </div>
      {selected.length ? (
        <>
          <div className="dashboard-main-grid">
            <Card>
              <SectionHeading
                title="Delivery by due week"
                subtitle="Current completion status · November sample"
              />
              <CompletionChart tasks={selected} />
            </Card>
            <Card>
              <SectionHeading title="Status distribution" />
              <StatusDistribution tasks={selected} />
            </Card>
          </div>
          <div className="two-column">
            <Card>
              <SectionHeading
                title="Team workload"
                subtitle="Open tasks due in the selected range"
              />
              <WorkloadChart tasks={selected} members={members} />
            </Card>
            <Card>
              <SectionHeading
                title="Priority distribution"
                subtitle="All tasks due in the selected range"
              />
              <div className="distribution">
                {priorities.map((p) => {
                  const count = selected.filter((t) => t.priority === p).length
                  return (
                    <div key={p}>
                      <div className="row-between">
                        <span className="capitalize">{p}</span>
                        <strong>{count}</strong>
                      </div>
                      <Progress
                        value={selected.length ? (count / selected.length) * 100 : 0}
                        label={`${p} priority share`}
                      />
                    </div>
                  )
                })}
              </div>
            </Card>
          </div>
        </>
      ) : (
        <Card>
          <EmptyState
            title="No tasks due in this range"
            description="Choose another period or create a task in this demo workspace."
            icon={<BarChart3 size={24} />}
          />
        </Card>
      )}
      <Card className="table-card">
        <SectionHeading
          title="Project delivery detail"
          subtitle="Task-based completion within the selected range"
        />
        <Table
          rows={projects}
          getKey={(p) => p.id}
          caption="Project completion summary"
          columns={[
            { label: 'Project', render: (p) => <strong>{p.name}</strong> },
            {
              label: 'Tasks due',
              render: (p) => selected.filter((t) => t.projectId === p.id).length,
            },
            {
              label: 'Complete',
              render: (p) =>
                selected.filter((t) => t.projectId === p.id && t.status === 'done').length,
            },
            {
              label: 'Completion',
              render: (p) => `${progress(selected.filter((t) => t.projectId === p.id))}%`,
            },
          ]}
        />
      </Card>
    </>
  )
}
