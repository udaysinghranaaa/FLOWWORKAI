import type { Connection } from 'mongoose'
import { createUserModel } from '../users/user.model.js'
import { sessionSchema } from './session.model.js'
import { actionTokenSchema } from './action-token.model.js'

export function createAuthModels(connection: Connection) {
  return {
    User: createUserModel(connection),
    Session: connection.model('AuthSession', sessionSchema, 'authSessions'),
    Verification: connection.model(
      'EmailVerificationToken',
      actionTokenSchema(),
      'emailVerificationTokens',
    ),
    Reset: connection.model('PasswordResetToken', actionTokenSchema(), 'passwordResetTokens'),
  }
}
export type AuthModels = ReturnType<typeof createAuthModels>

/** Add missing declared indexes only. Never sync/drop indexes or remove data. */
export async function ensureAuthIndexes(models: AuthModels) {
  for (const model of Object.values(models)) {
    await model.createCollection()
    await model.createIndexes()
  }
}
