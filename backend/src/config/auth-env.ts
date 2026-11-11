import { z } from 'zod'
import { ConfigurationError, type AppConfig } from './env.js'

const schema = z.object({
  MONGODB_URI: z
    .string()
    .min(1)
    .max(4096)
    .refine((value) => /^mongodb(?:\+srv)?:\/\//.test(value)),
  JWT_SECRET: z.string().regex(/^[a-fA-F0-9]{64,128}$/),
  JWT_ISSUER: z.string().min(1).max(128).default('flowwork-ai'),
  JWT_AUDIENCE: z.string().min(1).max(128).default('flowwork-web'),
  ACCESS_TOKEN_MINUTES: z.coerce.number().int().min(5).max(15).default(10),
  REFRESH_IDLE_DAYS: z.coerce.number().int().min(1).max(7).default(7),
  REFRESH_ABSOLUTE_DAYS: z.coerce.number().int().min(1).max(30).default(30),
  MAIL_MODE: z.enum(['capture', 'smtp']).default('capture'),
  SMTP_HOST: z.string().min(1).optional(),
  SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(465),
  SMTP_USER: z.string().min(1).optional(),
  SMTP_PASSWORD: z.string().min(1).optional(),
  MAIL_FROM: z.email().optional(),
})

export interface AuthConfig {
  mongoUri: string
  jwtSecret: string
  issuer: string
  audience: string
  accessSeconds: number
  idleMs: number
  absoluteMs: number
  secureCookies: boolean
  webOrigin: string
  mailMode: 'capture' | 'smtp'
  smtp: { host: string; port: number; user: string; password: string; from: string } | undefined
}

export function parseAuthEnv(raw: NodeJS.ProcessEnv, app: AppConfig): AuthConfig {
  const result = schema.safeParse(raw)
  if (!result.success)
    throw new ConfigurationError([
      ...new Set(result.error.issues.map((issue) => String(issue.path[0]))),
    ])
  const data = result.data
  if (app.nodeEnv === 'production' && data.MAIL_MODE !== 'smtp')
    throw new ConfigurationError(['MAIL_MODE'])
  if (
    data.MAIL_MODE === 'smtp' &&
    (!data.SMTP_HOST || !data.SMTP_USER || !data.SMTP_PASSWORD || !data.MAIL_FROM)
  )
    throw new ConfigurationError(['SMTP_HOST', 'SMTP_USER', 'SMTP_PASSWORD', 'MAIL_FROM'])
  return Object.freeze({
    mongoUri: data.MONGODB_URI,
    jwtSecret: data.JWT_SECRET,
    issuer: data.JWT_ISSUER,
    audience: data.JWT_AUDIENCE,
    accessSeconds: data.ACCESS_TOKEN_MINUTES * 60,
    idleMs: data.REFRESH_IDLE_DAYS * 86400000,
    absoluteMs: data.REFRESH_ABSOLUTE_DAYS * 86400000,
    secureCookies: app.nodeEnv === 'production',
    webOrigin: app.frontendOrigins[0]!,
    mailMode: data.MAIL_MODE,
    smtp:
      data.MAIL_MODE === 'smtp'
        ? {
            host: data.SMTP_HOST!,
            port: data.SMTP_PORT,
            user: data.SMTP_USER!,
            password: data.SMTP_PASSWORD!,
            from: data.MAIL_FROM!,
          }
        : undefined,
  })
}
