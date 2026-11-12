import type { Connection } from 'mongoose'
import { projectSchema } from '../projects/project.model.js'
import { projectMembershipSchema } from '../projects/project-membership.model.js'
import { taskSchema } from '../tasks/task.model.js'
import { taskCommentSchema } from '../tasks/task-comment.model.js'
import { activityEventSchema } from '../activity/activity-event.model.js'
export function createWorkModels(connection: Connection) {
  return {
    Project: connection.model('Project', projectSchema, 'projects'),
    ProjectMembership: connection.model(
      'ProjectMembership',
      projectMembershipSchema,
      'projectMemberships',
    ),
    Task: connection.model('Task', taskSchema, 'tasks'),
    Comment: connection.model('TaskComment', taskCommentSchema, 'taskComments'),
    Activity: connection.model('ActivityEvent', activityEventSchema, 'activityEvents'),
  }
}
export type WorkModels = ReturnType<typeof createWorkModels>
export async function ensureWorkIndexes(models: WorkModels) {
  for (const model of Object.values(models)) {
    await model.createCollection()
    await model.createIndexes()
  }
}
export async function workIndexesReady(models: WorkModels) {
  for (const model of Object.values(models)) {
    try {
      const indexes = await model.collection.listIndexes().toArray()
      for (const [keys, opts] of model.schema.indexes())
        if (
          !indexes.some(
            (index) =>
              JSON.stringify(index.key) === JSON.stringify(keys) &&
              !!index.unique === !!opts.unique &&
              JSON.stringify(index.partialFilterExpression) ===
                JSON.stringify(opts.partialFilterExpression),
          )
        )
          return false
    } catch {
      return false
    }
  }
  return true
}
