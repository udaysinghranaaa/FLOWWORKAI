import { Schema } from 'mongoose'
export const invitationSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      immutable: true,
    },
    invitedEmailNormalized: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 254,
    },
    intendedOrganizationRole: { type: String, enum: ['ADMIN', 'MEMBER'], required: true },
    targets: {
      type: [
        {
          workspaceId: { type: Schema.Types.ObjectId, required: true },
          role: { type: String, enum: ['ADMIN', 'MANAGER', 'MEMBER', 'VIEWER'], required: true },
          _id: false,
        },
      ],
      required: true,
      validate: (items: unknown[]) => items.length >= 1 && items.length <= 10,
    },
    invitedByUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    tokenHash: { type: String, required: true, select: false },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'revoked', 'expired'],
      default: 'pending',
      required: true,
    },
    expiresAt: { type: Date, required: true },
    lastSentAt: { type: Date, required: true },
    acceptedAt: { type: Date, default: null },
    revokedAt: { type: Date, default: null },
    message: { type: String, default: '', maxlength: 500 },
    purgeAt: { type: Date, required: true },
  },
  { timestamps: true, strict: 'throw', autoCreate: false, autoIndex: false },
)
invitationSchema.index(
  { organizationId: 1, invitedEmailNormalized: 1 },
  { unique: true, partialFilterExpression: { status: 'pending' } },
)
invitationSchema.index({ tokenHash: 1 }, { unique: true })
invitationSchema.index({ organizationId: 1, status: 1, _id: 1 })
invitationSchema.index({ invitedEmailNormalized: 1, status: 1, expiresAt: 1 })
invitationSchema.index({ purgeAt: 1 }, { expireAfterSeconds: 0 })
invitationSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete (ret as Record<string, unknown>).tokenHash
    return ret
  },
})
