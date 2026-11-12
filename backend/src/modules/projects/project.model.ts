import { Schema } from 'mongoose'
import {
  tenantFields,
  modelOptions,
  retryFields,
  versionField,
} from '../work-management/work.fields.js'
import { projectStatuses, priorities } from '../work-management/work.constants.js'
export const projectSchema = new Schema(
  {
    ...tenantFields,
    ...retryFields,
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 120 },
    slug: { type: String, required: true, match: /^[a-z0-9][a-z0-9-]{2,62}$/ },
    description: { type: String, default: '', maxlength: 5000 },
    ownerUserId: { type: Schema.Types.ObjectId, required: true, ref: 'User' },
    createdBy: { type: Schema.Types.ObjectId, required: true, immutable: true, ref: 'User' },
    status: { type: String, enum: projectStatuses, required: true, default: 'planned' },
    previousStatus: { type: String, enum: projectStatuses, default: 'planned' },
    priority: { type: String, enum: priorities, default: 'medium', required: true },
    startDate: { type: Date, default: null },
    dueDate: { type: Date, default: null },
    color: { type: String, enum: ['violet', 'blue', 'green', 'amber', 'rose'], default: 'violet' },
    version: versionField,
  },
  modelOptions,
)
projectSchema.index({ organizationId: 1, workspaceId: 1, slug: 1 }, { unique: true })
projectSchema.index({ workspaceId: 1, createdBy: 1, creationKey: 1 }, { unique: true })
projectSchema.index({ organizationId: 1, workspaceId: 1, status: 1, updatedAt: -1, _id: -1 })
projectSchema.index({ organizationId: 1, workspaceId: 1, createdAt: -1, _id: -1 })
