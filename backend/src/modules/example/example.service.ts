import type { ExampleCode, ValidateExampleInput } from './example.schema.js'

interface ExampleItem {
  code: ExampleCode
  title: string
}
export interface ExampleList {
  mode: 'development-only'
  items: ExampleItem[]
  persisted: false
}
export interface ExampleDetail {
  mode: 'development-only'
  item: ExampleItem
  persisted: false
}
export interface ExampleValidation {
  mode: 'development-only'
  validated: ValidateExampleInput['body']
  characterCount: number
  persisted: false
}
export interface ExampleService {
  list: (limit: number) => Promise<ExampleList>
  detail: (code: ExampleCode) => Promise<ExampleDetail>
  validate: (input: ValidateExampleInput['body']) => Promise<ExampleValidation>
}

/** A deterministic teaching catalog and pure computation. No stored users or business records. */
export function createExampleService(): ExampleService {
  const catalog: readonly ExampleItem[] = [
    { code: 'validation', title: 'Validated request boundaries' },
    { code: 'errors', title: 'Consistent operational errors' },
    { code: 'observability', title: 'Correlated structured logs' },
  ]
  return {
    list: async (limit) => ({
      mode: 'development-only',
      items: catalog.slice(0, limit).map((item) => ({ ...item })),
      persisted: false,
    }),
    detail: async (code) => {
      const item = catalog.find((candidate) => candidate.code === code)
      if (!item) throw new Error('The validated catalog code was not found.')
      return { mode: 'development-only', item: { ...item }, persisted: false }
    },
    validate: async (input) => ({
      mode: 'development-only',
      validated: { ...input },
      characterCount: input.label.length,
      persisted: false,
    }),
  }
}
