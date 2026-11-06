import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
  Cell,
} from 'recharts'
import { taskLabels, type Task, type Member } from '@/types/domain'

const colors = ['#818CF8', '#22D3EE', '#FBBF24', '#4ADE80', '#FB7185']
export function CompletionChart({ tasks }: { tasks: Task[] }) {
  const buckets = [
    { label: 'Nov 1–7', start: '2026-11-01', end: '2026-11-07' },
    { label: 'Nov 8–14', start: '2026-11-08', end: '2026-11-14' },
    { label: 'Nov 15–21', start: '2026-11-15', end: '2026-11-21' },
    { label: 'Nov 22–30', start: '2026-11-22', end: '2026-11-30' },
  ]
  const data = buckets.map((b) => ({
    name: b.label,
    Planned: tasks.filter((t) => t.dueAt >= b.start && t.dueAt <= b.end).length,
    Complete: tasks.filter((t) => t.dueAt >= b.start && t.dueAt <= b.end && t.status === 'done')
      .length,
  }))
  return (
    <>
      <div
        className="chart-container"
        role="img"
        aria-label="Current task completion by November due-date week. Exact counts are available in the table below."
      >
        <ResponsiveContainer width="100%" height={210} minWidth={0}>
          <AreaChart data={data} margin={{ top: 15, right: 8, left: -24, bottom: 0 }}>
            <defs>
              <linearGradient id="planned-fill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#818CF8" stopOpacity={0.22} />
                <stop offset="100%" stopColor="#818CF8" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 5" vertical={false} stroke="var(--border)" />
            <XAxis
              dataKey="name"
              axisLine={false}
              tickLine={false}
              tick={{ fill: 'var(--muted)', fontSize: 11 }}
              tickMargin={12}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
              tick={{ fill: 'var(--muted)', fontSize: 11 }}
            />
            <Tooltip
              contentStyle={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 10,
                color: 'var(--text)',
              }}
            />
            <Area
              dataKey="Planned"
              type="monotone"
              stroke="#818CF8"
              fill="url(#planned-fill)"
              strokeWidth={2}
              isAnimationActive={false}
            />
            <Area
              dataKey="Complete"
              type="monotone"
              stroke="#22D3EE"
              fill="transparent"
              strokeWidth={2}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="chart-legend">
        <span>
          <i style={{ background: colors[0] }} />
          Due this week
        </span>
        <span>
          <i style={{ background: colors[1] }} />
          Currently complete
        </span>
      </div>
      <details className="chart-data">
        <summary>View chart data</summary>
        <table>
          <caption>November tasks grouped by due date, not historical completion events</caption>
          <thead>
            <tr>
              <th scope="col">Due week</th>
              <th scope="col">Tasks</th>
              <th scope="col">Complete now</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.name}>
                <td>{d.name}</td>
                <td>{d.Planned}</td>
                <td>{d.Complete}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </>
  )
}
export function WorkloadChart({ tasks, members }: { tasks: Task[]; members: Member[] }) {
  const data = members
    .filter((m) => m.role !== 'Client')
    .map((m) => ({
      name: m.name.split(' ')[0],
      tasks: tasks.filter((t) => t.assigneeId === m.id && t.status !== 'done').length,
    }))
  return (
    <>
      <div
        className="chart-container"
        role="img"
        aria-label="Open tasks by teammate. Exact counts appear below."
      >
        <ResponsiveContainer width="100%" height={210} minWidth={0}>
          <BarChart data={data} margin={{ top: 12, left: -28, right: 10 }}>
            <CartesianGrid stroke="var(--border)" vertical={false} strokeDasharray="3 5" />
            <XAxis
              dataKey="name"
              tick={{ fill: 'var(--muted)', fontSize: 12 }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fill: 'var(--muted)', fontSize: 11 }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              cursor={{ fill: 'var(--hover)' }}
              contentStyle={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                color: 'var(--text)',
                borderRadius: 10,
              }}
            />
            <Bar dataKey="tasks" radius={[5, 5, 0, 0]} maxBarSize={38} isAnimationActive={false}>
              {data.map((d, i) => (
                <Cell key={d.name} fill={colors[i % colors.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <details className="chart-data">
        <summary>View workload counts</summary>
        <ul>
          {data.map((d) => (
            <li key={d.name}>
              {d.name}: {d.tasks} open tasks
            </li>
          ))}
        </ul>
      </details>
    </>
  )
}
export function StatusDistribution({ tasks }: { tasks: Task[] }) {
  return (
    <div className="distribution">
      {Object.entries(taskLabels).map(([status, label]) => {
        const count = tasks.filter((t) => t.status === status).length
        const statusColor = (
          {
            backlog: '#94A3B8',
            todo: '#67E8F9',
            in_progress: '#818CF8',
            review: '#FBBF24',
            done: '#4ADE80',
          } as Record<string, string>
        )[status]
        return (
          <div key={status}>
            <div className="row-between">
              <span>
                <i style={{ background: statusColor }} />
                {label}
              </span>
              <strong>{count}</strong>
            </div>
            <div className="distribution-track">
              <span
                style={{
                  width: `${tasks.length ? (count / tasks.length) * 100 : 0}%`,
                  background: statusColor,
                }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}
