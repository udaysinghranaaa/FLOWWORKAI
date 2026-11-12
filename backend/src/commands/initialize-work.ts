import { parseEnv } from '../config/env.js'
import { configureDns } from '../config/dns.js'
import { connectDatabase } from '../lib/database.js'
import { createLogger } from '../lib/logger.js'
import { createTenantModels } from '../modules/organizations/tenant.models.js'
import { tenantIndexesReady } from '../modules/organizations/tenant.schema-initialization.js'
import { createWorkModels, ensureWorkIndexes } from '../modules/work-management/work.models.js'
import { projectSchema } from '../modules/projects/project.model.js'
import { projectMembershipSchema } from '../modules/projects/project-membership.model.js'
import { taskSchema } from '../modules/tasks/task.model.js'
import { taskCommentSchema } from '../modules/tasks/task-comment.model.js'
import { activityEventSchema } from '../modules/activity/activity-event.model.js'
const schemas = {
  projects: projectSchema,
  projectMemberships: projectMembershipSchema,
  tasks: taskSchema,
  taskComments: taskCommentSchema,
  activityEvents: activityEventSchema,
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
          'Phase 5 schema ready',
          'Separate approval for intended environment',
          'Explicit --apply --rotation-confirmed --schema-approved --approved-for=development|production',
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
  if (!process.env.MONGODB_URI) throw new Error('Database configuration missing.')
  const database = await connectDatabase(
    process.env.MONGODB_URI,
    createLogger({ nodeEnv: config.nodeEnv, logLevel: 'silent' }),
  )
  try {
    if (!(await tenantIndexesReady(createTenantModels(database.connection))))
      throw new Error('Phase 5 schema must be initialized first.')
    await ensureWorkIndexes(createWorkModels(database.connection))
    console.log(JSON.stringify({ workSchemaInitialized: true, mode: 'apply' }))
  } finally {
    await database.close()
  }
}
void main().catch(() => {
  console.error(
    JSON.stringify({ workSchemaInitialized: false, code: 'WORK_SCHEMA_INITIALIZATION_FAILED' }),
  )
  process.exitCode = 1
})
