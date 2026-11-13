import { parseEnv } from '../config/env.js'
import { configureDns } from '../config/dns.js'
import { createLogger } from '../lib/logger.js'
import { connectDatabase } from '../lib/database.js'
import { createTenantModels, ensureTenantIndexes } from '../modules/organizations/tenant.models.js'
import { organizationSchema } from '../modules/organizations/organization.model.js'
import { workspaceSchema } from '../modules/workspaces/workspace.model.js'
import {
  organizationMembershipSchema,
  workspaceMembershipSchema,
} from '../modules/memberships/membership.models.js'
import { invitationSchema } from '../modules/invitations/invitation.model.js'

const schemas = {
  organizations: organizationSchema,
  workspaces: workspaceSchema,
  organizationMemberships: organizationMembershipSchema,
  workspaceMemberships: workspaceMembershipSchema,
  invitations: invitationSchema,
}
async function main() {
  if (!process.argv.includes('--apply')) {
    console.log(
      JSON.stringify({
        mode: 'plan',
        writes: false,
        collections: Object.entries(schemas).map(([collection, schema]) => ({
          collection,
          indexes: schema.indexes(),
        })),
        requirements: [
          'Private credential rotation',
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
    throw new Error('Explicit environment approval and private rotation are required.')
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
