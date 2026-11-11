import { connectDatabase, DatabaseConnectionError } from '../lib/database.js'
import { createLogger } from '../lib/logger.js'
import { ConfigurationError, parseDnsServers } from '../config/env.js'
import { configureDns } from '../config/dns.js'

async function main() {
  configureDns(parseDnsServers(process.env.DNS_SERVERS))
  if (!process.env.MONGODB_URI) {
    console.error(JSON.stringify({ connected: false, code: 'MONGODB_URI_MISSING' }))
    process.exitCode = 1
    return
  }
  const logger = createLogger({ nodeEnv: 'production', logLevel: 'silent' })
  const database = await connectDatabase(process.env.MONGODB_URI, logger)
  try {
    await database.connection.db!.command({ ping: 1 })
    console.log(JSON.stringify({ connected: true, pingSucceeded: true }))
  } finally {
    await database.close()
  }
}
void main().catch((error) => {
  console.error(
    JSON.stringify({
      connected: false,
      code:
        error instanceof ConfigurationError
          ? 'DATABASE_CONFIG_INVALID'
          : error instanceof DatabaseConnectionError
            ? error.code
            : 'DATABASE_CHECK_FAILED',
      ...(error instanceof ConfigurationError ? { fields: error.fields } : {}),
    }),
  )
  process.exitCode = 1
})
