import { parseEnv } from '../config/env.js'
import { configureDns } from '../config/dns.js'
import { createLogger } from '../lib/logger.js'
import { connectDatabase } from '../lib/database.js'
import { createTenantModels, ensureTenantIndexes } from '../modules/organizations/tenant.models.js'
async function main() {
  if (!process.argv.includes('--rotation-confirmed'))
    throw new Error('Confirm private credential rotation before initializing tenant indexes.')
  const config = parseEnv(process.env)
  configureDns(config.dnsServers)
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required.')
  const database = await connectDatabase(
    process.env.MONGODB_URI,
    createLogger({ nodeEnv: config.nodeEnv, logLevel: 'silent' }),
  )
  try {
    await ensureTenantIndexes(createTenantModels(database.connection))
    console.log(JSON.stringify({ tenantSchemaInitialized: true }))
  } finally {
    await database.close()
  }
}
void main().catch(() => {
  console.error(
    JSON.stringify({ tenantSchemaInitialized: false, code: 'TENANT_SCHEMA_INITIALIZATION_FAILED' }),
  )
  process.exitCode = 1
})
