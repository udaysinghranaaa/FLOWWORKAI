import { Schema } from 'mongoose'

export function actionTokenSchema() {
  const schema = new Schema(
    {
      userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
      hashedToken: { type: String, required: true, select: false, match: /^[a-f0-9]{64}$/ },
      expiresAt: { type: Date, required: true },
      consumedAt: { type: Date, default: null },
      purgeAt: { type: Date, required: true },
    },
    { timestamps: true, strict: 'throw', autoIndex: false, autoCreate: false },
  )
  schema.index({ hashedToken: 1 }, { unique: true })
  schema.index({ userId: 1, consumedAt: 1 })
  schema.index({ purgeAt: 1 }, { expireAfterSeconds: 0 })
  schema.set('toJSON', {
    transform: (_doc, ret) => {
      delete (ret as Record<string, unknown>).hashedToken
      delete (ret as Record<string, unknown>).__v
      return ret
    },
  })
  return schema
}
