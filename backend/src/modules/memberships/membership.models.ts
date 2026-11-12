import { Schema } from 'mongoose'
export const organizationRoles = ['OWNER', 'ADMIN', 'MEMBER'] as const
export const workspaceRoles = ['OWNER', 'ADMIN', 'MANAGER', 'MEMBER', 'VIEWER'] as const
export type OrganizationRole = (typeof organizationRoles)[number]
export type WorkspaceRole = (typeof workspaceRoles)[number]
const fields = {
  organizationId: {
    type: Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
    immutable: true,
  },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
  status: { type: String, enum: ['active', 'revoked'], default: 'active', required: true },
  joinedAt: { type: Date, default: Date.now, required: true },
}
const options = { timestamps: true, strict: 'throw' as const, autoCreate: false, autoIndex: false }
export const organizationMembershipSchema = new Schema(
  { ...fields, role: { type: String, enum: organizationRoles, required: true } },
  options,
)
organizationMembershipSchema.index({ organizationId: 1, userId: 1 }, { unique: true })
organizationMembershipSchema.index({ userId: 1, status: 1, _id: 1 })
organizationMembershipSchema.index(
  { organizationId: 1, role: 1 },
  { unique: true, partialFilterExpression: { role: 'OWNER', status: 'active' } },
)
export const workspaceMembershipSchema = new Schema(
  {
    ...fields,
    workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, immutable: true },
    role: { type: String, enum: workspaceRoles, required: true },
  },
  options,
)
workspaceMembershipSchema.index({ workspaceId: 1, userId: 1 }, { unique: true })
workspaceMembershipSchema.index({ organizationId: 1, userId: 1, status: 1 })
workspaceMembershipSchema.index(
  { workspaceId: 1, role: 1 },
  { unique: true, partialFilterExpression: { role: 'OWNER', status: 'active' } },
)
