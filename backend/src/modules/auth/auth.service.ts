import { randomUUID } from 'node:crypto'
import { Types, type ClientSession, type Connection } from 'mongoose'
import type { Logger } from 'pino'
import type { AuthConfig } from '../../config/auth-env.js'
import { ApiError } from '../../lib/api-error.js'
import type { MailAdapter } from '../../lib/mail.js'
import type { AuthModels } from './auth.models.js'
import type { UserRecord } from '../users/user.model.js'
import {
  createAccessTokens,
  createPasswordHasher,
  randomToken,
  tokenHash,
  unauthorized,
  validId,
} from './auth.crypto.js'

export interface SafeUser {
  id: string
  name: string
  email: string
  avatarUrl: string | null
  emailVerified: boolean
  accountStatus: string
}
export interface AuthContext {
  user: SafeUser
  userId: string
  sessionId: string
  version: number
}
interface Credentials {
  user: SafeUser
  sessionId: string
  accessToken: string
  refreshToken: string
  expiresAt: Date
}
type UserForDTO = Pick<
  UserRecord,
  'name' | 'email' | 'avatarUrl' | 'emailVerifiedAt' | 'accountStatus'
> & { _id: { toString: () => string } }
export const safeUser = (user: UserForDTO): SafeUser => ({
  id: user._id.toString(),
  name: user.name,
  email: user.email,
  avatarUrl: user.avatarUrl ?? null,
  emailVerified: !!user.emailVerifiedAt,
  accountStatus: user.accountStatus,
})
export const normalizeEmail = (email: string) => email.trim().toLowerCase()
const invalidAction = () =>
  new ApiError(
    410,
    'ACTION_TOKEN_INVALID',
    'This link is invalid, expired or already used. Request a new one.',
  )
const parseRefresh = (raw: string) => {
  const [id, secret, extra] = raw.split('.')
  return validId(id) && secret && /^[A-Za-z0-9_-]{43}$/.test(secret) && !extra ? id : undefined
}

export async function createAuthService({
  models,
  connection,
  config,
  mail,
  logger,
  now = () => new Date(),
}: {
  models: AuthModels
  connection: Connection
  config: AuthConfig
  mail: MailAdapter
  logger: Logger
  now?: () => Date
}) {
  const passwords = createPasswordHasher()
  const access = createAccessTokens(config)
  const dummyHash = await passwords.hash(randomToken())
  const pendingMail = new Set<Promise<void>>()
  async function transaction<T>(operation: (session: ClientSession) => Promise<T>): Promise<T> {
    const session = await connection.startSession()
    try {
      return await session.withTransaction(() => operation(session), {
        readConcern: { level: 'snapshot' },
        writeConcern: { w: 'majority' },
        maxCommitTimeMS: 5000,
      })
    } finally {
      await session.endSession()
    }
  }
  async function deliver(email: string, purpose: 'verify-email' | 'reset-password', token: string) {
    try {
      // Fragment keeps the credential out of HTTP request URLs/referrer headers.
      await mail.send({ to: email, purpose, link: `${config.webOrigin}/${purpose}#token=${token}` })
    } catch {
      // Generic public response prevents delivery failures becoming an account oracle.
      logger.error(
        { errorCode: 'MAIL_DELIVERY_FAILED' },
        'Authentication mail was not accepted; retry via the recovery workflow',
      )
    }
  }
  function notify(email: string, purpose: 'verify-email' | 'reset-password', token: string) {
    // Keep provider latency out of public account-eligibility timing and drain on shutdown.
    const task = deliver(email, purpose, token)
    pendingMail.add(task)
    void task.then(
      () => pendingMail.delete(task),
      () => pendingMail.delete(task),
    )
  }
  async function register(input: { name: string; email: string; password: string }) {
    const passwordHash = await passwords.hash(input.password)
    const token = randomToken()
    const date = now()
    let created = false
    try {
      created = await transaction(async (session) => {
        if (
          await models.User.exists({ normalizedEmail: normalizeEmail(input.email) }).session(
            session,
          )
        )
          return false
        const [user] = await models.User.create(
          [
            {
              name: input.name,
              email: normalizeEmail(input.email),
              normalizedEmail: normalizeEmail(input.email),
              passwordHash,
              lastVerificationSentAt: date,
            },
          ],
          { session },
        )
        await models.Verification.create(
          [
            {
              userId: user!._id,
              hashedToken: tokenHash(token),
              expiresAt: new Date(+date + 3600000),
              purgeAt: new Date(+date + 7 * 86400000),
            },
          ],
          { session },
        )
        return true
      })
    } catch (error) {
      if (!(typeof error === 'object' && error !== null && 'code' in error && error.code === 11000))
        throw error
    }
    if (created) notify(normalizeEmail(input.email), 'verify-email', token)
  }
  async function issueAction(email: string, purpose: 'verify-email' | 'reset-password') {
    const date = now(),
      token = randomToken()
    const field = purpose === 'verify-email' ? 'lastVerificationSentAt' : 'lastResetSentAt'
    const model = purpose === 'verify-email' ? models.Verification : models.Reset
    const recipient = await transaction(async (session) => {
      const user = await models.User.findOneAndUpdate(
        {
          normalizedEmail: normalizeEmail(email),
          accountStatus: 'active',
          ...(purpose === 'verify-email' ? { emailVerifiedAt: null } : {}),
          $or: [{ [field]: null }, { [field]: { $lte: new Date(+date - 60000) } }],
        },
        { $set: { [field]: date }, $inc: { authLock: 1 } },
        { session, returnDocument: 'after' },
      )
      if (!user) return undefined
      await model.updateMany(
        { userId: user._id, consumedAt: null },
        { $set: { consumedAt: date } },
        { session },
      )
      await model.create(
        [
          {
            userId: user._id,
            hashedToken: tokenHash(token),
            expiresAt: new Date(+date + (purpose === 'verify-email' ? 3600000 : 900000)),
            purgeAt: new Date(+date + 7 * 86400000),
          },
        ],
        { session },
      )
      return user.email
    })
    if (recipient) notify(recipient, purpose, token)
  }
  async function login(
    input: { email: string; password: string },
    userAgent: string,
  ): Promise<Credentials> {
    const snapshot = await models.User.findOne({
      normalizedEmail: normalizeEmail(input.email),
    }).select('+passwordHash')
    const matches = await passwords.verify(snapshot?.passwordHash ?? dummyHash, input.password)
    if (!snapshot || !matches || snapshot.accountStatus !== 'active')
      throw new ApiError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.')
    if (!snapshot.emailVerifiedAt)
      throw new ApiError(403, 'EMAIL_VERIFICATION_REQUIRED', 'Verify your email before signing in.')
    const date = now(),
      sessionId = new Types.ObjectId(),
      refreshToken = `${sessionId}.${randomToken()}`
    const expiresAt = new Date(+date + Math.min(config.idleMs, config.absoluteMs))
    const user = await transaction(async (session) => {
      // Writing the user guard serializes login with password reset/logout-all.
      const current = await models.User.findOneAndUpdate(
        {
          _id: snapshot._id,
          authVersion: snapshot.authVersion,
          passwordHash: snapshot.passwordHash,
          accountStatus: 'active',
          emailVerifiedAt: { $ne: null },
        },
        { $inc: { authLock: 1 } },
        { session, returnDocument: 'after' },
      )
      if (!current) throw unauthorized()
      if (
        (await models.Session.countDocuments({
          userId: current._id,
          revokedAt: null,
          expiresAt: { $gt: date },
        }).session(session)) >= 10
      ) {
        await models.Session.findOneAndUpdate(
          { userId: current._id, revokedAt: null },
          { $set: { revokedAt: date } },
          { session, sort: { createdAt: 1 } },
        )
      }
      await models.Session.create(
        [
          {
            _id: sessionId,
            userId: current._id,
            hashedRefreshToken: tokenHash(refreshToken),
            tokenFamilyId: randomUUID(),
            authVersion: current.authVersion,
            expiresAt,
            absoluteExpiresAt: new Date(+date + config.absoluteMs),
            lastUsedAt: date,
            purgeAt: new Date(+date + config.absoluteMs + 7 * 86400000),
            userAgentHash: tokenHash(userAgent.slice(0, 512)),
          },
        ],
        { session },
      )
      return current
    })
    return {
      user: safeUser(user),
      sessionId: String(sessionId),
      refreshToken,
      expiresAt,
      accessToken: await access.sign(String(user._id), String(sessionId), user.authVersion),
    }
  }
  async function authenticate(raw: string | undefined): Promise<AuthContext> {
    if (!raw || raw.length > 2048) throw unauthorized()
    const claims = await access.verify(raw),
      date = now()
    const [user, session] = await Promise.all([
      models.User.findOne({
        _id: claims.userId,
        accountStatus: 'active',
        emailVerifiedAt: { $ne: null },
        authVersion: claims.version,
      }),
      models.Session.findOne({
        _id: claims.sessionId,
        userId: claims.userId,
        authVersion: claims.version,
        revokedAt: null,
        expiresAt: { $gt: date },
        absoluteExpiresAt: { $gt: date },
      }),
    ])
    if (!user || !session) throw unauthorized()
    return {
      user: safeUser(user),
      userId: claims.userId,
      sessionId: claims.sessionId,
      version: claims.version,
    }
  }
  async function refresh(raw: string | undefined): Promise<Credentials> {
    const id = raw ? parseRefresh(raw) : undefined
    if (!id || !raw) throw unauthorized()
    const hash = tokenHash(raw),
      date = now(),
      replacement = `${id}.${randomToken()}`
    const result = await transaction(async (session) => {
      const row = await models.Session.findById(id)
        .select('+hashedRefreshToken +usedRefreshHashes')
        .session(session)
      if (!row || row.revokedAt || +row.expiresAt <= +date || +row.absoluteExpiresAt <= +date)
        return undefined
      if (row.hashedRefreshToken !== hash) {
        if (row.usedRefreshHashes.includes(hash))
          await models.Session.updateOne({ _id: id }, { $set: { revokedAt: date } }, { session })
        // Return, do not throw: replay revocation must commit.
        return undefined
      }
      if (row.usedRefreshHashes.length >= 512) {
        await models.Session.updateOne({ _id: id }, { $set: { revokedAt: date } }, { session })
        return undefined
      }
      const user = await models.User.findOneAndUpdate(
        {
          _id: row.userId,
          accountStatus: 'active',
          emailVerifiedAt: { $ne: null },
          authVersion: row.authVersion,
        },
        { $inc: { authLock: 1 } },
        { session, returnDocument: 'after' },
      )
      if (!user) {
        await models.Session.updateOne({ _id: id }, { $set: { revokedAt: date } }, { session })
        return undefined
      }
      const expiresAt = new Date(Math.min(+date + config.idleMs, +row.absoluteExpiresAt))
      const rotated = await models.Session.findOneAndUpdate(
        { _id: id, hashedRefreshToken: hash, revokedAt: null },
        {
          $set: { hashedRefreshToken: tokenHash(replacement), expiresAt, lastUsedAt: date },
          $push: { usedRefreshHashes: hash },
        },
        { session, returnDocument: 'after', runValidators: true },
      )
      if (!rotated) return undefined
      return { user, expiresAt }
    })
    if (!result) throw unauthorized()
    return {
      user: safeUser(result.user),
      sessionId: id,
      refreshToken: replacement,
      expiresAt: result.expiresAt,
      accessToken: await access.sign(String(result.user._id), id, result.user.authVersion),
    }
  }
  async function logout(accessToken: string | undefined, refreshToken: string | undefined) {
    if (accessToken) {
      const claims = await access.verify(accessToken).catch(() => undefined)
      if (claims)
        await models.Session.updateOne(
          { _id: claims.sessionId, userId: claims.userId, revokedAt: null },
          { $set: { revokedAt: now() } },
        )
    }
    const id = refreshToken ? parseRefresh(refreshToken) : undefined
    if (id && refreshToken) {
      const hash = tokenHash(refreshToken)
      await models.Session.updateOne(
        {
          _id: id,
          $or: [{ hashedRefreshToken: hash }, { usedRefreshHashes: hash }],
          revokedAt: null,
        },
        { $set: { revokedAt: now() } },
      )
    }
  }
  async function logoutAll(context: AuthContext) {
    await transaction(async (session) => {
      await models.User.updateOne(
        { _id: context.userId },
        { $inc: { authVersion: 1, authLock: 1 } },
        { session },
      )
      await models.Session.updateMany(
        { userId: context.userId, revokedAt: null },
        { $set: { revokedAt: now() } },
        { session },
      )
    })
  }
  async function verifyEmail(token: string) {
    const changed = await transaction(async (session) => {
      const date = now()
      const action = await models.Verification.findOneAndUpdate(
        { hashedToken: tokenHash(token), consumedAt: null, expiresAt: { $gt: date } },
        { $set: { consumedAt: date } },
        { session, returnDocument: 'after' },
      )
      if (!action) return false
      const user = await models.User.findOneAndUpdate(
        { _id: action.userId, accountStatus: 'active', emailVerifiedAt: null },
        { $set: { emailVerifiedAt: date }, $inc: { authLock: 1 } },
        { session, returnDocument: 'after' },
      )
      if (!user) throw invalidAction()
      await models.Verification.updateMany(
        { userId: user._id, consumedAt: null },
        { $set: { consumedAt: date } },
        { session },
      )
      return true
    })
    if (!changed) throw invalidAction()
  }
  async function resetPassword(token: string, password: string) {
    const passwordHash = await passwords.hash(password)
    const changed = await transaction(async (session) => {
      const date = now()
      const action = await models.Reset.findOneAndUpdate(
        { hashedToken: tokenHash(token), consumedAt: null, expiresAt: { $gt: date } },
        { $set: { consumedAt: date } },
        { session, returnDocument: 'after' },
      )
      if (!action) return false
      const user = await models.User.findOneAndUpdate(
        { _id: action.userId, accountStatus: 'active' },
        { $set: { passwordHash }, $inc: { authVersion: 1, authLock: 1 } },
        { session, returnDocument: 'after' },
      )
      if (!user) throw invalidAction()
      await models.Reset.updateMany(
        { userId: user._id, consumedAt: null },
        { $set: { consumedAt: date } },
        { session },
      )
      await models.Session.updateMany(
        { userId: user._id, revokedAt: null },
        { $set: { revokedAt: date } },
        { session },
      )
      return true
    })
    if (!changed) throw invalidAction()
  }
  return {
    register,
    login,
    refresh,
    authenticate,
    logout,
    logoutAll,
    verifyEmail,
    resetPassword,
    drainMail: () => Promise.all([...pendingMail]).then(() => undefined),
    forgotPassword: (email: string) => issueAction(email, 'reset-password'),
    resendVerification: (email: string) => issueAction(email, 'verify-email'),
  }
}
export type AuthService = Awaited<ReturnType<typeof createAuthService>>
