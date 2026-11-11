import { EventEmitter } from 'node:events'
import type { Server } from 'node:http'
import type { RequestHandler, Request, Response, NextFunction } from 'express'
import { describe, it, expect, vi } from 'vitest'
import { registerProcessHandlers } from '../../src/lib/server-lifecycle.js'
import { normalizeError } from '../../src/middleware/error-handler.js'
import { asyncHandler } from '../../src/lib/async-handler.js'
import { capturedLogger } from '../helpers.js'

function processStub() {
  const emitter = new EventEmitter() as EventEmitter & {
    exitCode?: number
    exit: ReturnType<typeof vi.fn>
  }
  emitter.exit = vi.fn()
  return { emitter, target: emitter as unknown as NodeJS.Process }
}
describe('fatal errors and process-handler hygiene', () => {
  it('registers process listeners idempotently, drains once and disposes handlers', async () => {
    const { emitter, target } = processStub()
    const { logger } = capturedLogger()
    const shutdown = vi.fn(async () => {})
    const running = { server: {} as Server, shutdown }
    const dispose = registerProcessHandlers(running, logger, target)
    expect(registerProcessHandlers(running, logger, target)).toBe(dispose)
    expect(emitter.listenerCount('SIGTERM')).toBe(1)
    emitter.emit('SIGTERM')
    emitter.emit('SIGINT')
    await vi.waitFor(() => expect(emitter.listenerCount('SIGTERM')).toBe(0))
    expect(shutdown).toHaveBeenCalledTimes(1)
    expect(shutdown).toHaveBeenCalledWith('SIGTERM')
    expect(emitter.exit).not.toHaveBeenCalled()
  })
  it('exits nonzero on fatal process failure or failed bounded shutdown without logging a raw message', async () => {
    const { emitter, target } = processStub()
    const capture = capturedLogger()
    const dispose = registerProcessHandlers(
      {
        server: {} as Server,
        shutdown: vi.fn(async () => {
          throw new Error('private shutdown detail')
        }),
      },
      capture.logger,
      target,
    )
    emitter.emit('unhandledRejection', new Error('private rejection detail'))
    await vi.waitFor(() => expect(emitter.exit).toHaveBeenCalledWith(1))
    expect(emitter.exitCode).toBe(1)
    expect(capture.lines.join('')).not.toMatch(/private shutdown detail|private rejection detail/)
    dispose()
  })
  it('normalizes non-Error thrown objects without exposing arbitrary fields', () => {
    const result = normalizeError({ password: 'not-public', statusCode: 200 })
    expect(result.code).toBe('INTERNAL_ERROR')
    expect(result.statusCode).toBe(500)
    expect(result.message).not.toContain('not-public')
  })
  it.each(['sync', 'async'])('explicit async adapter forwards a %s failure once', async (mode) => {
    const error = new Error('test failure')
    const next = vi.fn()
    const handler: RequestHandler =
      mode === 'sync'
        ? () => {
            throw error
          }
        : async () => {
            throw error
          }
    asyncHandler(handler)({} as Request, {} as Response, next as NextFunction)
    await vi.waitFor(() => expect(next).toHaveBeenCalledTimes(1))
    expect(next).toHaveBeenCalledWith(error)
  })
})
