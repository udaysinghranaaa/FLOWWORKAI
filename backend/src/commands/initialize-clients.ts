import { parseEnv } from '../config/env.js'
import { configureDns } from '../config/dns.js'
import { connectDatabase } from '../lib/database.js'
import { createLogger } from '../lib/logger.js'
import { createTenantModels } from '../modules/organizations/tenant.models.js'
import { tenantIndexesReady } from '../modules/organizations/tenant.schema-initialization.js'
import { createWorkModels, workIndexesReady } from '../modules/work-management/work.models.js'
import {
  clientSchemas,
  createClientModels,
  ensureClientIndexes,
} from '../modules/clients/client.models.js'
async function main() {
  if (!process.argv.includes('--apply')) {
    console.log(
      JSON.stringify({
        mode: 'plan',
        writes: false,
        collections: Object.entries(clientSchemas).map(([collection, schema]) => ({
          collection,
          indexes: schema.indexes(),
        })),
        requirements: [
          'Private credential rotation',
          'Phase 5 and 6 schema ready',
          'Separate approval for intended environment',
          '--apply --rotation-confirmed --schema-approved --approved-for=development|production',
        ],
      }),
    )
    return
  }
  const config = parseEnv(process.env)
  if (
    config.nodeEnv === 'test' ||
    !process.argv.includes('--rotation-confirmed') ||
    !process.argv.includes('--schema-approved') ||
    !process.argv.includes('--approved-for=' + config.nodeEnv)
  )
    throw new Error('Explicit approval required.')
  configureDns(config.dnsServers)
  if (!process.env.MONGODB_URI) throw new Error('Missing database configuration.')
  const db = await connectDatabase(
    process.env.MONGODB_URI,
    createLogger({ nodeEnv: config.nodeEnv, logLevel: 'silent' }),
  )
  try {
    if (
      !(await tenantIndexesReady(createTenantModels(db.connection))) ||
      !(await workIndexesReady(createWorkModels(db.connection)))
    )
      throw new Error('Prior schema not ready.')
    await ensureClientIndexes(createClientModels(db.connection))
    console.log(JSON.stringify({ clientSchemaInitialized: true, mode: 'apply' }))
  } finally {
    await db.close()
  }
}
void main().catch(() => {
  console.error(
    JSON.stringify({ clientSchemaInitialized: false, code: 'CLIENT_SCHEMA_INITIALIZATION_FAILED' }),
  )
  process.exitCode = 1
})
