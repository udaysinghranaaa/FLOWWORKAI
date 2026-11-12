import { z } from 'zod'
import { idSchema, slugSchema } from '../organizations/tenant.schema.js'
import { projectStatuses, taskStatuses, priorities } from './work.constants.js'
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (value) =>
      !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value,
    'Use a valid calendar date.',
  )
  .nullable()
const dates = { startDate: date.optional(), dueDate: date.optional() }
const version = z.number().int().min(1)
const dateRange = (v: {
  startDate?: string | null | undefined
  dueDate?: string | null | undefined
}) => !v.startDate || !v.dueDate || v.startDate <= v.dueDate
export const projectCreate = z
  .strictObject({
    name: z.string().trim().min(2).max(120),
    slug: slugSchema,
    description: z.string().trim().max(5000).default(''),
    status: z.enum(projectStatuses).exclude(['archived']).default('planned'),
    priority: z.enum(priorities).default('medium'),
    color: z.enum(['violet', 'blue', 'green', 'amber', 'rose']).default('violet'),
    ...dates,
    creationKey: z.uuid(),
  })
  .refine(dateRange, 'Start date must precede the due date.')
export const projectUpdate = z
  .strictObject({
    name: z.string().trim().min(2).max(120).optional(),
    slug: slugSchema.optional(),
    description: z.string().trim().max(5000).optional(),
    status: z.enum(projectStatuses).optional(),
    priority: z.enum(priorities).optional(),
    color: z.enum(['violet', 'blue', 'green', 'amber', 'rose']).optional(),
    ...dates,
    version,
    ownerUserId: idSchema.optional(),
  })
  .refine((v) => Object.keys(v).length > 1, 'Choose a field to change.')
  .refine(dateRange, 'Invalid date range.')
const taskBase = z.strictObject({
  title: z.string().trim().min(2).max(200),
  description: z.string().trim().max(10000).default(''),
  status: z.enum(taskStatuses).default('todo'),
  priority: z.enum(priorities).default('medium'),
  assigneeId: idSchema.nullable().default(null),
  labels: z
    .array(z.string().trim().min(1).max(30))
    .max(10)
    .refine((v) => new Set(v).size === v.length)
    .default([]),
  ...dates,
  parentTaskId: idSchema.nullable().default(null),
  creationKey: z.uuid(),
})
export const taskCreate = taskBase.refine(dateRange, 'Invalid date range.')
export const subtaskCreate = taskBase
  .omit({ parentTaskId: true })
  .refine(dateRange, 'Invalid date range.')
export const taskUpdate = z
  .strictObject({
    title: z.string().trim().min(2).max(200).optional(),
    description: z.string().trim().max(10000).optional(),
    status: z.enum(taskStatuses).optional(),
    priority: z.enum(priorities).optional(),
    assigneeId: idSchema.nullable().optional(),
    labels: z
      .array(z.string().trim().min(1).max(30))
      .max(10)
      .refine((v) => new Set(v).size === v.length)
      .optional(),
    ...dates,
    version,
    archived: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 1, 'Choose a field to change.')
  .refine(dateRange, 'Invalid date range.')
export const memberBody = z.strictObject({
  userId: idSchema,
  role: z.enum(['MANAGER', 'CONTRIBUTOR', 'VIEWER']),
  version,
})
export const versionBody = z.strictObject({ version })
export const moveBody = z.strictObject({
  version,
  boardVersion: version,
  status: z.enum(taskStatuses),
  beforeId: idSchema.nullable().default(null),
})
export const commentCreate = z.strictObject({
  text: z.string().trim().min(1).max(4000),
  creationKey: z.uuid(),
})
export const commentUpdate = z.strictObject({ text: z.string().trim().min(1).max(4000), version })
export const listQuery = z.strictObject({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().max(600).optional(),
  search: z.string().trim().max(100).optional(),
  status: z.enum(projectStatuses).optional(),
  sort: z.enum(['updatedAt', 'createdAt']).default('updatedAt'),
})
export const taskQuery = listQuery
  .omit({ status: true, sort: true })
  .extend({
    status: z.enum(taskStatuses).optional(),
    priority: z.enum(priorities).optional(),
    assigneeId: z.union([idSchema, z.literal('me'), z.literal('unassigned')]).optional(),
    projectId: idSchema.optional(),
    dueBefore: date.unwrap().optional(),
    dueAfter: date.unwrap().optional(),
    parentTaskId: idSchema.optional(),
    archived: z.enum(['false', 'true', 'all']).default('false'),
    sort: z.enum(['updatedAt', 'createdAt', 'dueDate']).default('updatedAt'),
  })
  .refine(
    (v) => !v.dueAfter || !v.dueBefore || v.dueAfter <= v.dueBefore,
    'Invalid due date range.',
  )
export const pageQuery = listQuery.pick({ limit: true, cursor: true })
export const boardQuery = z
  .strictObject({
    limit: z.coerce.number().int().min(1).max(50).default(20),
    status: z.enum(taskStatuses).optional(),
    cursor: z.coerce.number().int().min(0).max(Number.MAX_SAFE_INTEGER).optional(),
  })
  .refine((v) => v.cursor === undefined || !!v.status, 'Column is required for cursor.')
export type ProjectCreate = z.output<typeof projectCreate>
export type ProjectUpdate = z.output<typeof projectUpdate>
export type TaskCreate = z.output<typeof taskCreate>
export type TaskUpdate = z.output<typeof taskUpdate>
export type ListQuery = z.output<typeof listQuery>
export type TaskQuery = z.output<typeof taskQuery>
export type PageQuery = z.output<typeof pageQuery>
