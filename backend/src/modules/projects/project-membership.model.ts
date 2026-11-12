import { Schema } from 'mongoose'
import { projectFields, modelOptions } from '../work-management/work.fields.js'
export const projectMembershipSchema = new Schema(
  {
    ...projectFields,
    userId: { type: Schema.Types.ObjectId, required: true, immutable: true, ref: 'User' },
    role: { type: String, enum: ['MANAGER', 'CONTRIBUTOR', 'VIEWER'], required: true },
    status: { type: String, enum: ['active', 'revoked'], required: true, default: 'active' },
  },
  modelOptions,
)
projectMembershipSchema.index({ projectId: 1, userId: 1 }, { unique: true })
projectMembershipSchema.index({
  organizationId: 1,
  workspaceId: 1,
  userId: 1,
  status: 1,
  projectId: 1,
})
