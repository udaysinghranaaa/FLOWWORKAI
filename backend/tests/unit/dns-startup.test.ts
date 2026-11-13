import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as DatabaseModule from '../../src/lib/database.js'

const state = vi.hoisted(() => ({ order: [] as string[], error: vi.fn(), fatal: vi.fn() }))
vi.mock('node:dns', () => ({
  default: {
    setServers: vi.fn(() => {
      state.order.push('dns')
    }),
  },
}))
vi.mock('../../src/lib/logger.js', () => ({
  createLogger: () => ({ error: state.error, fatal: state.fatal }),
}))
vi.mock('../../src/lib/mail.js', () => ({
  createMailAdapter: () => ({ send: vi.fn(), close: vi.fn() }),
}))
vi.mock('../../src/lib/database.js', async (importOriginal) => {
  const actual = await importOriginal<typeof DatabaseModule>()
  return {
    ...actual,
    connectDatabase: vi.fn(async () => {
      state.order.push('database')
      throw new actual.DatabaseConnectionError('DATABASE_UNAVAILABLE')
    }),
  }
})

let exitCode: typeof process.exitCode
let argv: string[]
beforeEach(() => {
  vi.resetModules()
  state.order.length = 0
  state.error.mockClear()
  exitCode = process.exitCode
  argv = process.argv
  vi.stubEnv('NODE_ENV', 'development')
  vi.stubEnv('DNS_SERVERS', '8.8.8.8,8.8.4.4')
  vi.stubEnv('MONGODB_URI', 'mongodb://127.0.0.1/flowwork_test_dns')
  vi.stubEnv('JWT_SECRET', '0123456789abcdef'.repeat(4))
  vi.stubEnv('FRONTEND_ORIGIN', 'https://console.example.com')
  vi.stubEnv('MAIL_MODE', 'smtp')
  vi.stubEnv('SMTP_HOST', '127.0.0.1')
  vi.stubEnv('SMTP_USER', 'test')
  vi.stubEnv('SMTP_PASSWORD', 'test-only')
  vi.stubEnv('MAIL_FROM', 'test@example.com')
})
afterEach(() => {
  process.exitCode = exitCode
  process.argv = argv
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('DNS precedes database initialization in actual process entrypoints', () => {
  it('prints the tenant plan without connecting, even with the legacy rotation flag', async () => {
    process.argv = ['node', 'initialize-tenants.js', '--rotation-confirmed']
    const output = vi.spyOn(console, 'log').mockImplementation(() => {})
    await import('../../src/commands/initialize-tenants.js')
    expect(state.order).toEqual([])
    const plan = JSON.parse(String(output.mock.calls[0]?.[0]))
    expect(plan).toMatchObject({ mode: 'plan', writes: false })
    expect(plan.collections).toHaveLength(5)
  })
  it.each([
    ['--apply'],
    ['--apply', '--rotation-confirmed'],
    ['--apply', '--rotation-confirmed', '--schema-approved'],
    ['--apply', '--rotation-confirmed', '--schema-approved', '--approved-for=production'],
  ])('blocks incomplete or wrong-environment tenant approval: %j', async (...flags) => {
    process.argv = ['node', 'initialize-tenants.js', ...flags]
    const output = vi.spyOn(console, 'error').mockImplementation(() => {})
    await import('../../src/commands/initialize-tenants.js')
    await vi.waitFor(() => expect(output).toHaveBeenCalled())
    expect(state.order).toEqual([])
    expect(process.exitCode).toBe(1)
  })
  it('configures DNS before an explicitly approved tenant connection', async () => {
    process.argv = [
      'node',
      'initialize-tenants.js',
      '--apply',
      '--rotation-confirmed',
      '--schema-approved',
      '--approved-for=development',
    ]
    const output = vi.spyOn(console, 'error').mockImplementation(() => {})
    await import('../../src/commands/initialize-tenants.js')
    await vi.waitFor(() => expect(output).toHaveBeenCalled())
    expect(state.order).toEqual(['dns', 'database'])
  })
  it.each([false, true])(
    'configures the server before connecting, production flag %s',
    async (production) => {
      process.argv = production ? ['node', 'server.js', '--production'] : ['node', 'server.js']
      await import('../../src/server.js')
      await vi.waitFor(() => expect(state.error).toHaveBeenCalled())
      expect(state.order).toEqual(['dns', 'database'])
    },
  )
  it('configures db:check in its own process startup path before connecting', async () => {
    const output = vi.spyOn(console, 'error').mockImplementation(() => {})
    await import('../../src/commands/check-database.js')
    await vi.waitFor(() => expect(output).toHaveBeenCalled())
    expect(state.order).toEqual(['dns', 'database'])
  })
  it('rejects malformed DNS without invoking the database or disclosing the value', async () => {
    vi.stubEnv('DNS_SERVERS', 'private-invalid-resolver')
    const output = vi.spyOn(console, 'error').mockImplementation(() => {})
    await import('../../src/commands/check-database.js')
    await vi.waitFor(() => expect(output).toHaveBeenCalled())
    expect(state.order).toEqual([])
    expect(JSON.parse(String(output.mock.calls[0]?.[0]))).toEqual({
      connected: false,
      code: 'DATABASE_CONFIG_INVALID',
      fields: ['DNS_SERVERS'],
    })
  })
})
