import { Schema } from 'mongoose'
export const workspaceSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      immutable: true,
    },
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 120 },
    normalizedSlug: { type: String, required: true, match: /^[a-z0-9][a-z0-9-]{2,62}$/ },
    description: { type: String, default: '', maxlength: 1000 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
    status: { type: String, enum: ['active', 'archived'], default: 'active', required: true },
    revision: { type: Number, default: 1, required: true },
    creationKey: { type: String, required: true, immutable: true },
    requestDigest: { type: String, required: true, select: false },
  },
  { timestamps: true, strict: 'throw', autoCreate: false, autoIndex: false },
)
workspaceSchema.index({ organizationId: 1, normalizedSlug: 1 }, { unique: true })
workspaceSchema.index({ organizationId: 1, createdBy: 1, creationKey: 1 }, { unique: true })
workspaceSchema.index({ organizationId: 1, status: 1, _id: 1 })
