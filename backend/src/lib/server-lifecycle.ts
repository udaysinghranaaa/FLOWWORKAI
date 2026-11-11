import { createServer, type Server } from 'node:http'
import type { Express } from 'express'
import type { Logger } from 'pino'
import type { AppConfig } from '../config/env.js'
import type { LifecycleState } from '../modules/health/health.service.js'

export interface RunningServer {
  server: Server
  shutdown: (reason: string) => Promise<void>
}
interface ServerOptions {
  app: Express
  config: AppConfig
  logger: Logger
  lifecycle: LifecycleState
  shutdownTimeoutMs?: number
  cleanupHooks?: readonly (() => Promise<void>)[]
}

export async function startHttpServer({
  app,
  config,
  logger,
  lifecycle,
  shutdownTimeoutMs = 10_000,
  cleanupHooks = [],
}: ServerOptions): Promise<RunningServer> {
  const server = createServer(app)
  server.requestTimeout = 15_000
  server.headersTimeout = 10_000
  server.keepAliveTimeout = 5_000
  server.maxHeadersCount = 100
  lifecycle.ready = false
  await new Promise<void>((resolve, reject) => {
    const onError = (error: Error) => {
      server.removeListener('listening', onListening)
      reject(error)
    }
    const onListening = () => {
      server.removeListener('error', onError)
      resolve()
    }
    server.once('error', onError)
    server.once('listening', onListening)
    server.listen(config.port, config.host)
  })
  lifecycle.ready = true
  logger.info({ port: config.port }, 'HTTP server listening')
  let shutdownPromise: Promise<void> | undefined
  const shutdown = (reason: string): Promise<void> => {
    if (shutdownPromise) return shutdownPromise
    lifecycle.ready = false
    lifecycle.draining = true
    logger.info({ reason }, 'HTTP shutdown started')
    shutdownPromise = new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        server.closeAllConnections()
        reject(new Error('Shutdown deadline exceeded.'))
      }, shutdownTimeoutMs)
      server.close((error) => {
        void (async () => {
          if (error && (error as NodeJS.ErrnoException).code !== 'ERR_SERVER_NOT_RUNNING')
            throw error
          const results = await Promise.allSettled(
            cleanupHooks.map((hook) => Promise.resolve().then(hook)),
          )
          if (results.some((result) => result.status === 'rejected'))
            throw new Error('A shutdown cleanup hook failed.')
        })().then(
          () => {
            clearTimeout(timer)
            logger.info('HTTP server stopped')
            resolve()
          },
          (error) => {
            clearTimeout(timer)
            reject(error)
          },
        )
      })
      server.closeIdleConnections()
    })
    return shutdownPromise
  }
  return { server, shutdown }
}

const registrations = new WeakMap<NodeJS.Process, () => void>()

/** Idempotent per process, with cleanup so tests/development do not accumulate listeners. */
export function registerProcessHandlers(
  running: RunningServer,
  logger: Logger,
  processTarget: NodeJS.Process = process,
): () => void {
  const existing = registrations.get(processTarget)
  if (existing) return existing
  let stopping = false
  const stop = (reason: string, failure: boolean, error?: unknown) => {
    if (failure) {
      processTarget.exitCode = 1
      logger.fatal({ err: error }, 'Fatal process failure; shutting down')
    }
    if (stopping) return
    stopping = true
    void running
      .shutdown(reason)
      .catch((shutdownError) => {
        processTarget.exitCode = 1
        logger.fatal({ err: shutdownError }, 'Bounded shutdown failed')
        processTarget.exit(1)
      })
      .finally(dispose)
  }
  const sigint = () => stop('SIGINT', false)
  const sigterm = () => stop('SIGTERM', false)
  const rejection = (error: unknown) => stop('unhandledRejection', true, error)
  const exception = (error: Error) => stop('uncaughtException', true, error)
  const dispose = () => {
    registrations.delete(processTarget)
    processTarget.removeListener('SIGINT', sigint)
    processTarget.removeListener('SIGTERM', sigterm)
    processTarget.removeListener('unhandledRejection', rejection)
    processTarget.removeListener('uncaughtException', exception)
  }
  processTarget.on('SIGINT', sigint)
  processTarget.on('SIGTERM', sigterm)
  processTarget.on('unhandledRejection', rejection)
  processTarget.on('uncaughtException', exception)
  registrations.set(processTarget, dispose)
  return dispose
}
