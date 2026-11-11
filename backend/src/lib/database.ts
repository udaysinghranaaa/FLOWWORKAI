import mongoose from 'mongoose'
import type { Logger } from 'pino'

export class DatabaseConnectionError extends Error {
  constructor(
    public readonly code:
      | 'DATABASE_URI_INVALID'
      | 'DATABASE_DNS_FAILED'
      | 'DATABASE_AUTH_FAILED'
      | 'DATABASE_UNAVAILABLE',
  ) {
    super(
      code === 'DATABASE_URI_INVALID'
        ? 'MongoDB rejected the connection string format or options; check it privately in backend/.env.'
        : 'MongoDB connectivity failed; check credentials, DNS and network access privately.',
    )
    this.name = 'DatabaseConnectionError'
  }
}

export async function connectDatabase(uri: string, logger: Logger) {
  const connection = mongoose.createConnection()
  let healthy = false
  connection.on('connected', () => {
    healthy = true
    logger.info('Database connected')
  })
  connection.on('reconnected', () => {
    healthy = true
    logger.info('Database reconnected')
  })
  connection.on('disconnected', () => {
    healthy = false
    logger.warn('Database disconnected; readiness disabled')
  })
  connection.on('error', () => {
    healthy = false
    logger.error(
      { errorCode: 'DATABASE_UNAVAILABLE' },
      'Database connection error; credentials omitted',
    )
  })
  try {
    await connection.openUri(uri, {
      serverSelectionTimeoutMS: 8000,
      connectTimeoutMS: 5000,
      socketTimeoutMS: 10000,
      maxPoolSize: 10,
      minPoolSize: 0,
      autoIndex: false,
      autoCreate: false,
      bufferCommands: false,
      retryWrites: true,
    })
  } catch (error) {
    await connection.close().catch(() => {})
    const name = error instanceof Error ? error.name : ''
    const message = error instanceof Error ? error.message : ''
    const cause = error instanceof Error ? error.cause : undefined
    const invalidUrlCause =
      typeof cause === 'object' &&
      cause !== null &&
      'code' in cause &&
      cause.code === 'ERR_INVALID_URL'
    const code =
      name === 'MongoParseError' ||
      invalidUrlCause ||
      /^Unable to parse|Invalid URL|Invalid connection string/.test(message)
        ? 'DATABASE_URI_INVALID'
        : /ENOTFOUND|querySrv|DNS/i.test(message)
          ? 'DATABASE_DNS_FAILED'
          : /Authentication failed|bad auth/i.test(message)
            ? 'DATABASE_AUTH_FAILED'
            : 'DATABASE_UNAVAILABLE'
    throw new DatabaseConnectionError(code)
  }
  return {
    connection,
    isReady: () => healthy && connection.readyState === 1,
    close: () => connection.close(),
  }
}
