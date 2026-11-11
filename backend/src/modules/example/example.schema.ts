import { z } from 'zod'

export const exampleCode = z.enum(['validation', 'errors', 'observability'])
const empty = z.strictObject({})
export const listExampleSchema = z.strictObject({
  body: z.undefined(),
  params: empty,
  query: z.strictObject({ limit: z.coerce.number().int().min(1).max(3).default(3) }),
})
export const detailExampleSchema = z.strictObject({
  body: z.undefined(),
  query: empty,
  params: z.strictObject({ code: exampleCode }),
})
export const validateExampleSchema = z.strictObject({
  params: empty,
  query: empty,
  body: z.strictObject({
    label: z
      .string({ error: 'Label must be a string.' })
      .trim()
      .min(2, 'Use at least 2 characters.')
      .max(80, 'Use at most 80 characters.'),
    count: z
      .number({ error: 'Count must be a number.' })
      .int('Count must be a whole number.')
      .min(1, 'Count must be at least 1.')
      .max(100, 'Count must be at most 100.'),
    category: z.enum(['general', 'technical']).default('general'),
  }),
})
export type ExampleCode = z.infer<typeof exampleCode>
export type ListExampleInput = z.output<typeof listExampleSchema>
export type DetailExampleInput = z.output<typeof detailExampleSchema>
export type ValidateExampleInput = z.output<typeof validateExampleSchema>
