import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { DEMO_DATE } from '@/mocks/fixtures'
import type { Task } from '@/types/domain'
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
export const initials = (name: string) =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((x) => x[0])
    .join('')
export function formatDate(value: string) {
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(
    new Date(value.length === 10 ? `${value}T12:00:00Z` : value),
  )
}
export const isOverdue = (task: Task) => task.status !== 'done' && task.dueAt < DEMO_DATE
export function progress(tasks: Task[]) {
  return tasks.length
    ? Math.round((tasks.filter((t) => t.status === 'done').length / tasks.length) * 100)
    : 0
}
