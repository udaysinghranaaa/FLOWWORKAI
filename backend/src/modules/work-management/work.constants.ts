export const workConfig = {
  defaults: { projectStatus: 'planned', taskStatus: 'todo', priority: 'medium' },
  colors: ['violet', 'blue', 'green', 'amber', 'rose'],
  projectStatuses: [
    { value: 'planned', label: 'Planned' },
    { value: 'active', label: 'Active' },
    { value: 'on_hold', label: 'On Hold' },
    { value: 'completed', label: 'Completed' },
    { value: 'archived', label: 'Archived' },
  ],
  taskStatuses: [
    { value: 'todo', label: 'Todo' },
    { value: 'in_progress', label: 'In Progress' },
    { value: 'in_review', label: 'In Review' },
    { value: 'done', label: 'Done' },
  ],
  priorities: [
    { value: 'low', label: 'Low' },
    { value: 'medium', label: 'Medium' },
    { value: 'high', label: 'High' },
    { value: 'urgent', label: 'Urgent' },
  ],
} as const
export const projectStatuses = workConfig.projectStatuses.map((item) => item.value)
export const taskStatuses = workConfig.taskStatuses.map((item) => item.value)
export const priorities = workConfig.priorities.map((item) => item.value)
export const projectTransitions: Record<
  (typeof projectStatuses)[number],
  readonly (typeof projectStatuses)[number][]
> = {
  planned: ['active', 'on_hold', 'completed', 'archived'],
  active: ['on_hold', 'completed', 'archived'],
  on_hold: ['active', 'completed', 'archived'],
  completed: ['active', 'archived'],
  archived: ['planned', 'active', 'on_hold', 'completed'],
}
