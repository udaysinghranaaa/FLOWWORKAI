import { Schema } from 'mongoose'
import {
  projectFields,
  modelOptions,
  retryFields,
  versionField,
} from '../work-management/work.fields.js'
export const taskCommentSchema = new Schema(
  {
    ...projectFields,
    ...retryFields,
    taskId: { type: Schema.Types.ObjectId, required: true, immutable: true, ref: 'Task' },
    authorId: { type: Schema.Types.ObjectId, required: true, immutable: true, ref: 'User' },
    text: { type: String, required: true, trim: true, minlength: 1, maxlength: 4000 },
    deletedAt: { type: Date, default: null },
    version: versionField,
  },
  modelOptions,
)
taskCommentSchema.index({ taskId: 1, authorId: 1, creationKey: 1 }, { unique: true })
taskCommentSchema.index({
  organizationId: 1,
  workspaceId: 1,
  projectId: 1,
  taskId: 1,
  createdAt: -1,
  _id: -1,
})
