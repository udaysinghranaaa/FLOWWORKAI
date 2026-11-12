import { Schema } from 'mongoose'
import {
  projectFields,
  modelOptions,
  retryFields,
  versionField,
} from '../work-management/work.fields.js'
import { taskStatuses, priorities } from '../work-management/work.constants.js'
export const taskSchema = new Schema(
  {
    ...projectFields,
    ...retryFields,
    title: { type: String, required: true, trim: true, minlength: 2, maxlength: 200 },
    description: { type: String, default: '', maxlength: 10000 },
    status: { type: String, enum: taskStatuses, required: true, default: 'todo' },
    priority: { type: String, enum: priorities, required: true, default: 'medium' },
    assigneeId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
    parentTaskId: { type: Schema.Types.ObjectId, ref: 'Task', default: null, immutable: true },
    labels: {
      type: [String],
      default: [],
      validate: (items: string[]) =>
        items.length <= 10 && items.every((value) => value.length >= 1 && value.length <= 30),
    },
    startDate: { type: Date, default: null },
    dueDate: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    archivedAt: { type: Date, default: null },
    position: { type: Number, required: true, min: 0, max: Number.MAX_SAFE_INTEGER },
    version: versionField,
  },
  modelOptions,
)
taskSchema.index({ projectId: 1, createdBy: 1, creationKey: 1 }, { unique: true })
taskSchema.index(
  { organizationId: 1, workspaceId: 1, projectId: 1, parentTaskId: 1, status: 1, position: 1 },
  { unique: true, partialFilterExpression: { archivedAt: null } },
)
taskSchema.index({
  organizationId: 1,
  workspaceId: 1,
  projectId: 1,
  archivedAt: 1,
  updatedAt: -1,
  _id: -1,
})
taskSchema.index({
  organizationId: 1,
  workspaceId: 1,
  assigneeId: 1,
  archivedAt: 1,
  dueDate: 1,
  _id: 1,
})
