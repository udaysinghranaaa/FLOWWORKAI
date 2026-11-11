import { pino, type Logger, type DestinationStream } from 'pino'
import { pinoHttp } from 'pino-http'
import type { IncomingMessage } from 'node:http'
import type { Response } from 'express'
import type { AppConfig } from '../config/env.js'

export function safeDiagnostic(error: unknown): { type: string; frames: string[] } {
  return {
    type:
      error instanceof Error &&
      ['Error', 'TypeError', 'RangeError', 'ApiError', 'ConfigurationError'].includes(error.name)
        ? error.name
        : 'UnknownError',
    frames:
      error instanceof Error
        ? (error.stack
            ?.split('\n')
            .slice(1)
            .filter((line) => /^\s+at /.test(line))
            .slice(0, 8) ?? [])
        : [],
  }
}

export function createLogger(
  config: Pick<AppConfig, 'nodeEnv' | 'logLevel'>,
  destination?: DestinationStream,
): Logger {
  const options = {
    level: config.logLevel,
    base: { service: 'flowwork-ai-api', environment: config.nodeEnv },
    redact: {
      paths: [
        'password',
        'passwordHash',
        'token',
        'apiKey',
        'authorization',
        'cookie',
        'req.headers',
        'req.body',
        'res.headers',
        'body',
        'headers',
      ],
      censor: '[REDACTED]',
    },
    serializers: { err: safeDiagnostic },
  }
  return destination ? pino(options, destination) : pino(options)
}

export function createHttpLogger(logger: Logger) {
  return pinoHttp<IncomingMessage, Response>({
    logger,
    genReqId: (_req, res) => String(res.getHeader('X-Request-ID')),
    wrapSerializers: false,
    serializers: {
      req: (req: { method?: string }) => ({ method: req.method }),
      res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
      err: safeDiagnostic,
    },
    customLogLevel: (_req, res, error) =>
      error || res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info',
    customProps: (_req, res) => ({ requestId: String(res.getHeader('X-Request-ID')) }),
    customSuccessObject: (_req, res, value) => ({
      ...value,
      path: res.locals.routeTemplate ?? '[unmatched]',
      ...(res.locals.errorCode ? { errorCode: res.locals.errorCode } : {}),
    }),
    customErrorObject: (_req, res, _error, value) => ({
      ...value,
      path: res.locals.routeTemplate ?? '[unmatched]',
      errorCode: res.locals.errorCode ?? 'INTERNAL_ERROR',
    }),
    customSuccessMessage: () => 'HTTP request completed',
    customErrorMessage: () => 'HTTP request failed',
  })
}
