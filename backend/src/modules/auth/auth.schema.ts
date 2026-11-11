import { z } from 'zod'

const empty = z.strictObject({})
const email = z
  .string()
  .trim()
  .max(254)
  .pipe(z.email())
  .transform((value) => value.toLowerCase())
const commonPasswords = new Set([
  'password1234',
  'password12345',
  'password123456',
  '123456789012',
  'qwerty1234567',
  'letmein123456',
])
export const passwordPolicy = z
  .string()
  .min(12, 'Use at least 12 characters.')
  .max(128, 'Use at most 128 characters.')
  .refine((value) => !commonPasswords.has(value.toLowerCase()), 'Choose a less common password.')
const token = z.string().regex(/^[A-Za-z0-9_-]{43}$/, 'This link is invalid.')
const requestSchema = <T extends z.ZodType>(body: T) =>
  z.strictObject({ body, params: empty, query: empty })
export const registerSchema = requestSchema(
  z.strictObject({ name: z.string().trim().min(2).max(120), email, password: passwordPolicy }),
)
export const loginSchema = requestSchema(
  z.strictObject({ email, password: z.string().min(1).max(128) }),
)
export const emailSchema = requestSchema(z.strictObject({ email }))
export const verifySchema = requestSchema(z.strictObject({ token }))
export const resetSchema = requestSchema(z.strictObject({ token, password: passwordPolicy }))
export const emptySchema = requestSchema(empty.optional())
export const readSchema = requestSchema(z.undefined())
