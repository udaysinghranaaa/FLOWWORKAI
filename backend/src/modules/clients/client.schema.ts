import { z } from 'zod'
import { idSchema, pageSchema } from '../organizations/tenant.schema.js'
const text = (max: number) => z.string().trim().max(max)
export const safeUrl = z.union([
  z.literal(''),
  z
    .url()
    .max(2048)
    .refine((value) => {
      try {
        const u = new URL(value)
        return (
          u.protocol === 'https:' &&
          !u.username &&
          !u.password &&
          !u.hash &&
          !/^(localhost|127\.|0\.|10\.|192\.168\.|169\.254\.|\[|.*\.local$)/i.test(u.hostname) &&
          !/^172\.(1[6-9]|2\d|3[01])\./.test(u.hostname)
        )
      } catch {
        return false
      }
    }, 'Use an HTTPS reference without credentials or local addresses.'),
])
const email = z.string().trim().toLowerCase().max(254).pipe(z.email())
export const roles = ['CLIENT_ADMIN', 'CLIENT_MEMBER', 'CLIENT_VIEWER'] as const
export const statuses = ['lead', 'active', 'on_hold', 'inactive', 'archived'] as const
export const kinds = [
  'progress',
  'milestone',
  'feedback',
  'reply',
  'change',
  'deliverable',
] as const
export const version = z.number().int().min(1)
const clientFields = {
  name: text(120).min(2),
  legalName: text(160),
  type: text(80),
  industry: text(120),
  description: text(3000),
  website: safeUrl,
  email: z.union([z.literal(''), email]),
  phone: text(50),
  country: text(80),
  city: text(100),
  address: text(500),
  ownerId: idSchema,
  status: z.enum(statuses),
  tags: z.array(text(40).min(1)).max(20),
  allowRepresentatives: z.boolean(),
}
export const createClient = z
  .strictObject({ ...clientFields })
  .partial()
  .required({ name: true })
  .extend({ creationKey: z.uuid() })
export const updateClient = z
  .strictObject({ ...clientFields })
  .partial()
  .extend({ version })
const contactFields = {
  name: text(120).min(2),
  email,
  title: text(120),
  phone: text(50),
  role: text(80),
  primary: z.boolean(),
  archived: z.boolean(),
}
export const createContact = z
  .strictObject(contactFields)
  .partial()
  .required({ name: true, email: true })
export const updateContact = z.strictObject(contactFields).partial().extend({ version })
export const invite = z.strictObject({
  contactId: idSchema,
  role: z.enum(roles),
  expiresInHours: z.number().int().min(1).max(168).default(72),
})
export const membership = z.strictObject({
  version,
  role: z.enum(roles).optional(),
  status: z.enum(['active', 'revoked']).optional(),
})
const grantFields = {
  title: text(120).min(2),
  description: text(3000),
  status: z.enum(['active', 'revoked']),
  progress: z.boolean(),
  milestones: z.boolean(),
  deliverables: z.boolean(),
  feedback: z.boolean(),
  changes: z.boolean(),
  approve: z.boolean(),
}
export const share = z
  .strictObject(grantFields)
  .partial()
  .required({ title: true })
  .extend({ projectId: idSchema })
export const updateGrant = z.strictObject(grantFields).partial().extend({ version })
const date = z.union([z.literal(''), z.iso.date()])
const resourceFields = {
  title: text(160).min(2),
  body: text(5000),
  status: text(40).min(1),
  published: z.boolean(),
  progress: z.number().int().min(0).max(100),
  dueDate: date,
  position: z.number().int().min(0).max(1000000),
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
  url: safeUrl,
  fileName: text(160),
  contentType: text(100),
  size: z.number().int().min(0).max(1e12).nullable(),
}
export const createResource = z
  .strictObject(resourceFields)
  .partial()
  .required({ title: true })
  .extend({
    kind: z.enum(kinds),
    creationKey: z.uuid(),
    parentId: idSchema.optional(),
    previousId: idSchema.optional(),
  })
export const updateResource = z
  .strictObject(resourceFields)
  .partial()
  .extend({ version, decisionNote: text(2000).optional(), taskId: idSchema.optional() })
export const query = pageSchema.extend({
  search: text(120).optional(),
  status: text(40).optional(),
  kind: z.enum(kinds).optional(),
  parentId: idSchema.optional(),
  sort: z.enum(['oldest', 'newest', 'position']).default('oldest'),
})
export const versionBody = z.strictObject({ version })
export type Query = z.output<typeof query>
export type CreateClient = z.output<typeof createClient>
export type UpdateClient = z.output<typeof updateClient>
export type ContactInput = z.output<typeof createContact>
export type ResourceInput = z.output<typeof createResource>
export type ResourceUpdate = z.output<typeof updateResource>
