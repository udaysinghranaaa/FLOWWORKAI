import { Schema } from 'mongoose'
export const tenantFields = {
  organizationId: {
    type: Schema.Types.ObjectId,
    required: true,
    immutable: true,
    ref: 'Organization',
  },
  workspaceId: { type: Schema.Types.ObjectId, required: true, immutable: true, ref: 'Workspace' },
}
export const projectFields = {
  ...tenantFields,
  projectId: { type: Schema.Types.ObjectId, required: true, immutable: true, ref: 'Project' },
}
export const modelOptions = {
  timestamps: true,
  strict: 'throw' as const,
  autoCreate: false,
  autoIndex: false,
  toJSON: {
    transform: (_document: unknown, value: Record<string, unknown>) => {
      delete value.requestDigest
      delete value.creationKey
      delete value.__v
      return value
    },
  },
} as const
export const retryFields = {
  creationKey: { type: String, required: true, immutable: true },
  requestDigest: { type: String, required: true, select: false },
}
export const versionField = { type: Number, required: true, default: 1, min: 1 }
