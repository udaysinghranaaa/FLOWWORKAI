import { createHash, randomBytes } from 'node:crypto'
import argon2 from 'argon2'
import { SignJWT, jwtVerify } from 'jose'
import type { AuthConfig } from '../../config/auth-env.js'
import { ApiError } from '../../lib/api-error.js'

export const randomToken = () => randomBytes(32).toString('base64url')
export const tokenHash = (value: string) => createHash('sha256').update(value).digest('hex')
export const validId = (value: unknown): value is string =>
  typeof value === 'string' && /^[a-f0-9]{24}$/.test(value)
export const unauthorized = () => new ApiError(401, 'UNAUTHENTICATED', 'Sign in again to continue.')

export function createPasswordHasher() {
  let active = 0
  async function bounded<T>(operation: () => Promise<T>): Promise<T> {
    if (active >= 4) throw new ApiError(429, 'RATE_LIMITED', 'Please wait before trying again.')
    active++
    try {
      return await operation()
    } finally {
      active--
    }
  }
  return {
    hash: (password: string) =>
      bounded(() =>
        argon2.hash(password, {
          type: argon2.argon2id,
          memoryCost: 19456,
          timeCost: 2,
          parallelism: 1,
        }),
      ),
    verify: (hash: string, password: string) => bounded(() => argon2.verify(hash, password)),
  }
}

export function createAccessTokens(config: AuthConfig) {
  const key = Buffer.from(config.jwtSecret, 'hex')
  return {
    sign: (userId: string, sessionId: string, version: number) =>
      new SignJWT({ sid: sessionId, sv: version, tokenType: 'access' })
        .setProtectedHeader({ alg: 'HS256', typ: 'at+jwt' })
        .setIssuer(config.issuer)
        .setAudience(config.audience)
        .setSubject(userId)
        .setIssuedAt()
        .setExpirationTime(`${config.accessSeconds}s`)
        .sign(key),
    verify: async (token: string) => {
      try {
        const { payload, protectedHeader } = await jwtVerify(token, key, {
          algorithms: ['HS256'],
          issuer: config.issuer,
          audience: config.audience,
          requiredClaims: ['sub', 'exp', 'iat', 'sid', 'sv'],
          maxTokenAge: `${config.accessSeconds}s`,
        })
        if (
          protectedHeader.typ !== 'at+jwt' ||
          payload.tokenType !== 'access' ||
          !validId(payload.sub) ||
          !validId(payload.sid) ||
          !Number.isInteger(payload.sv) ||
          Number(payload.sv) < 0
        )
          throw unauthorized()
        return { userId: payload.sub, sessionId: payload.sid, version: Number(payload.sv) }
      } catch {
        throw unauthorized()
      }
    },
  }
}
