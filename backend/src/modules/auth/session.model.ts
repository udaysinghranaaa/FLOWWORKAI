import { Schema } from 'mongoose'

export const sessionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, required: true, ref: 'User' },
    hashedRefreshToken: { type: String, required: true, select: false, match: /^[a-f0-9]{64}$/ },
    tokenFamilyId: { type: String, required: true },
    usedRefreshHashes: {
      type: [String],
      default: [],
      select: false,
      validate: (values: string[]) => values.length <= 512,
    },
    authVersion: { type: Number, required: true, min: 0 },
    expiresAt: { type: Date, required: true },
    absoluteExpiresAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null },
    lastUsedAt: { type: Date, required: true },
    purgeAt: { type: Date, required: true },
    userAgentHash: { type: String, maxlength: 64 },
  },
  { timestamps: true, strict: 'throw', autoIndex: false, autoCreate: false },
)
sessionSchema.index({ hashedRefreshToken: 1 }, { unique: true })
sessionSchema.index({ tokenFamilyId: 1 }, { unique: true })
sessionSchema.index({ userId: 1, revokedAt: 1 })
sessionSchema.index({ purgeAt: 1 }, { expireAfterSeconds: 0 })
sessionSchema.set('toJSON', {
  transform: (_doc, ret) => {
    for (const key of [
      'hashedRefreshToken',
      'usedRefreshHashes',
      'userAgentHash',
      'authVersion',
      '__v',
    ])
      delete (ret as Record<string, unknown>)[key]
    return ret
  },
})
