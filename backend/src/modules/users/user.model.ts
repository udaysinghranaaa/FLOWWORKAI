import { Schema, type Connection, type InferSchemaType } from 'mongoose'

export const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 120 },
    email: {
      type: String,
      required: true,
      trim: true,
      maxlength: 254,
      match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    },
    normalizedEmail: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      maxlength: 254,
      match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    },
    passwordHash: { type: String, required: true, select: false, match: /^\$argon2id\$/ },
    emailVerifiedAt: { type: Date, default: null },
    accountStatus: {
      type: String,
      enum: ['active', 'disabled', 'deletion_pending'],
      default: 'active',
      required: true,
    },
    avatarUrl: {
      type: String,
      default: null,
      maxlength: 2048,
      validate: (value: string | null) => value === null || /^https:\/\//.test(value),
    },
    authVersion: { type: Number, default: 0, required: true, min: 0, validate: Number.isInteger },
    authLock: { type: Number, default: 0, required: true, select: false },
    lastVerificationSentAt: { type: Date, default: null },
    lastResetSentAt: { type: Date, default: null },
  },
  { timestamps: true, strict: 'throw', autoIndex: false, autoCreate: false },
)
userSchema.index({ normalizedEmail: 1 }, { unique: true })
userSchema.set('toJSON', {
  transform: (_doc, ret) => {
    for (const key of [
      'passwordHash',
      'authVersion',
      'authLock',
      'lastVerificationSentAt',
      'lastResetSentAt',
      '__v',
    ])
      delete (ret as Record<string, unknown>)[key]
    return ret
  },
})
export type UserRecord = InferSchemaType<typeof userSchema>
export function createUserModel(connection: Connection) {
  return connection.model('User', userSchema, 'users')
}
