import { describe, it, expect, vi } from 'vitest'
import { createExampleService } from '../../src/modules/example/example.service.js'
import { startHttpServer } from '../../src/lib/server-lifecycle.js'
import { testApp, testConfig, capturedLogger } from '../helpers.js'

describe('HTTP lifecycle on isolated ephemeral ports', () => {
  it('drains in-flight work, stops accepting work and runs future cleanup hooks once', async () => {
    const lifecycle = { ready: false, draining: false }
    const { logger } = capturedLogger()
    const config = { ...testConfig(), port: 0 }
    let release!: () => void
    let started!: () => void
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const entered = new Promise<void>((resolve) => {
      started = resolve
    })
    const service = createExampleService()
    const cleanup = vi.fn(async () => {})
    const app = testApp({
      config,
      lifecycle,
      logger,
      exampleService: {
        ...service,
        list: async (limit) => {
          started()
          await gate
          return service.list(limit)
        },
      },
    })
    const running = await startHttpServer({
      app,
      config,
      logger,
      lifecycle,
      cleanupHooks: [cleanup],
    })
    const address = running.server.address()
    if (!address || typeof address === 'string') throw new Error('No ephemeral listener')
    expect(lifecycle.ready).toBe(true)
    const responsePromise = fetch(`http://127.0.0.1:${address.port}/api/v1/example`)
    await entered
    const closing = running.shutdown('test-drain')
    expect(running.shutdown('duplicate-signal')).toBe(closing)
    expect(lifecycle).toEqual({ ready: false, draining: true })
    release()
    expect((await responsePromise).status).toBe(200)
    await closing
    expect(running.server.listening).toBe(false)
    expect(cleanup).toHaveBeenCalledTimes(1)
  })
  it('rejects address conflicts without leaving a second listener running', async () => {
    const { logger } = capturedLogger()
    const config = { ...testConfig(), port: 0 }
    const lifecycle = { ready: false, draining: false }
    const running = await startHttpServer({
      app: testApp({ config, logger, lifecycle }),
      config,
      logger,
      lifecycle,
    })
    try {
      const address = running.server.address()
      if (!address || typeof address === 'string') throw new Error('No listener')
      await expect(
        startHttpServer({
          app: testApp(),
          config: { ...config, port: address.port },
          logger,
          lifecycle: { ready: false, draining: false },
        }),
      ).rejects.toMatchObject({ code: 'EADDRINUSE' })
    } finally {
      await running.shutdown('test-cleanup')
    }
  })
  it('bounds a hung request and destroys its connection after the deadline', async () => {
    const { logger } = capturedLogger()
    const config = { ...testConfig(), port: 0 }
    const lifecycle = { ready: false, draining: false }
    let entered!: () => void
    const started = new Promise<void>((resolve) => {
      entered = resolve
    })
    const service = createExampleService()
    const app = testApp({
      logger,
      config,
      lifecycle,
      exampleService: {
        ...service,
        list: () => {
          entered()
          return new Promise(() => {})
        },
      },
    })
    const running = await startHttpServer({
      app,
      config,
      logger,
      lifecycle,
      shutdownTimeoutMs: 100,
    })
    const address = running.server.address()
    if (!address || typeof address === 'string') throw new Error('No listener')
    const response = fetch(`http://127.0.0.1:${address.port}/api/v1/example`).then(
      () => 'completed',
      () => 'disconnected',
    )
    await started
    await expect(running.shutdown('test-timeout')).rejects.toThrow('Shutdown deadline exceeded')
    expect(await response).toBe('disconnected')
  })
  it('surfaces cleanup-hook failures instead of claiming a successful shutdown', async () => {
    const { logger } = capturedLogger()
    const config = { ...testConfig(), port: 0 }
    const lifecycle = { ready: false, draining: false }
    const running = await startHttpServer({
      app: testApp({ logger, config, lifecycle }),
      logger,
      config,
      lifecycle,
      cleanupHooks: [
        async () => {
          throw new Error('private cleanup failure')
        },
      ],
    })
    await expect(running.shutdown('test-hook')).rejects.toThrow('A shutdown cleanup hook failed')
    expect(running.server.listening).toBe(false)
  })
})
