import { z } from 'zod'
export const idSchema = z.string().regex(/^[a-f0-9]{24}$/)
const name = z.string().trim().min(2).max(120)
export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9][a-z0-9-]{2,62}$/)
  .refine(
    (value) =>
      !['api', 'app', 'admin', 'auth', 'new', 'settings', 'onboarding', 'workspaces'].includes(
        value,
      ),
    'Choose a different slug.',
  )
const description = z.string().trim().max(1000)
const website = z.union([
  z.literal(''),
  z
    .url()
    .max(2048)
    .refine((value) => /^https?:\/\//.test(value)),
])
export const createOrganizationBody = z.strictObject({
  name,
  slug: slugSchema,
  workspaceName: name,
  workspaceSlug: slugSchema,
  website: website.default(''),
  industry: z.string().trim().max(120).default(''),
  description: description.default(''),
  creationKey: z.uuid(),
})
export const createWorkspaceBody = z.strictObject({
  name,
  slug: slugSchema,
  description: description.default(''),
  creationKey: z.uuid(),
})
export const updateOrganizationBody = z
  .strictObject({
    name: name.optional(),
    description: description.optional(),
    website: website.optional(),
    industry: z.string().trim().max(120).optional(),
    status: z.enum(['active', 'archived']).optional(),
    version: z.number().int().min(1),
  })
  .refine((value) => Object.keys(value).length > 1, 'Provide a field to update.')
export const updateWorkspaceBody = z
  .strictObject({
    name: name.optional(),
    slug: slugSchema.optional(),
    description: description.optional(),
    status: z.enum(['active', 'archived']).optional(),
    version: z.number().int().min(1),
  })
  .refine((value) => Object.keys(value).length > 1, 'Provide a field to update.')
export const inviteBody = z.strictObject({
  email: z
    .string()
    .trim()
    .max(254)
    .pipe(z.email())
    .transform((value) => value.toLowerCase()),
  organizationRole: z.enum(['ADMIN', 'MEMBER']),
  targets: z
    .array(
      z.strictObject({
        workspaceId: idSchema,
        role: z.enum(['ADMIN', 'MANAGER', 'MEMBER', 'VIEWER']),
      }),
    )
    .min(1)
    .max(10)
    .refine((items) => new Set(items.map((item) => item.workspaceId)).size === items.length),
  message: z.string().trim().max(500).default(''),
})
export const invitationTokenBody = z.strictObject({
  token: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
})
export const organizationRoleBody = z.strictObject({ role: z.enum(['ADMIN', 'MEMBER']) })
export const workspaceRoleBody = z.strictObject({
  role: z.enum(['ADMIN', 'MANAGER', 'MEMBER', 'VIEWER']),
})
export const pageSchema = z.strictObject({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: idSchema.optional(),
})
export type PageInput = z.output<typeof pageSchema>
export type CreateOrganization = z.output<typeof createOrganizationBody>
export type CreateWorkspace = z.output<typeof createWorkspaceBody>
export type InviteInput = z.output<typeof inviteBody>
