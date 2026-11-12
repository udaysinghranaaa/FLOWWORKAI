import { Schema } from 'mongoose'
import { projectFields, modelOptions } from '../work-management/work.fields.js'
export const activityEventSchema = new Schema(
  {
    ...projectFields,
    taskId: { type: Schema.Types.ObjectId, ref: 'Task', default: null },
    actorId: { type: Schema.Types.ObjectId, required: true, immutable: true, ref: 'User' },
    action: { type: String, required: true, maxlength: 60 },
    metadata: {
      fields: { type: [String], default: [] },
      from: { type: String, maxlength: 80 },
      to: { type: String, maxlength: 80 },
    },
  },
  modelOptions,
)
activityEventSchema.index({
  organizationId: 1,
  workspaceId: 1,
  projectId: 1,
  createdAt: -1,
  _id: -1,
})
activityEventSchema.index({ organizationId: 1, workspaceId: 1, taskId: 1, createdAt: -1, _id: -1 })
