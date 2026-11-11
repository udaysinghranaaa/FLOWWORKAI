import { isIP } from 'node:net'
import { z } from 'zod'

const levels = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'] as const
const localOrigins = 'http://localhost:5173,http://127.0.0.1:5173'

const dnsServersSchema = z
  .string()
  .max(1024)
  .transform((value) => (value.trim() ? value.split(',').map((server) => server.trim()) : []))
  .pipe(z.array(z.string().refine((server) => isIP(server) !== 0 && !server.includes('%'))).max(8))
  .transform((servers) => [...new Set(servers)])
  .default([])

function isOrigin(value: string): boolean {
  try {
    const url = new URL(value)
    return (
      ['http:', 'https:'].includes(url.protocol) &&
      url.origin === value &&
      !url.username &&
      !url.password
    )
  } catch {
    return false
  }
}

const environmentSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z
      .string()
      .regex(/^\d+$/)
      .transform(Number)
      .pipe(z.number().int().min(1).max(65535))
      .default(5000),
    HOST: z
      .string()
      .min(1)
      .max(253)
      .refine((value) => value === 'localhost' || isIP(value) !== 0)
      .default('127.0.0.1'),
    FRONTEND_ORIGIN: z.string().min(1).max(2048).optional(),
    LOG_LEVEL: z.enum(levels).optional(),
    DNS_SERVERS: dnsServersSchema,
  })
  .superRefine((values, ctx) => {
    const origins = (
      values.FRONTEND_ORIGIN ?? (values.NODE_ENV === 'production' ? '' : localOrigins)
    )
      .split(',')
      .map((value) => value.trim())
    if (!origins.length || origins.length > 10 || origins.some((value) => !isOrigin(value))) {
      ctx.addIssue({
        code: 'custom',
        path: ['FRONTEND_ORIGIN'],
        message: 'Use 1–10 exact HTTP(S) origins.',
      })
    }
    if (
      values.NODE_ENV === 'production' &&
      origins.some((value) => !value.startsWith('https://'))
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['FRONTEND_ORIGIN'],
        message: 'Production requires explicit HTTPS origins.',
      })
    }
  })

export interface AppConfig {
  nodeEnv: 'development' | 'test' | 'production'
  port: number
  host: string
  frontendOrigins: readonly string[]
  logLevel: (typeof levels)[number]
  dnsServers: readonly string[]
}

export class ConfigurationError extends Error {
  constructor(public readonly fields: readonly string[]) {
    super(
      `Invalid backend configuration: ${fields.join(', ')}. Check backend/.env.example; values are not shown.`,
    )
    this.name = 'ConfigurationError'
  }
}

/** Pure parser: importing a module never loads .env, opens a port or exits a process. */
export function parseDnsServers(raw: string | undefined): readonly string[] {
  const parsed = dnsServersSchema.safeParse(raw)
  if (!parsed.success) throw new ConfigurationError(['DNS_SERVERS'])
  return Object.freeze(parsed.data)
}

export function parseEnv(raw: NodeJS.ProcessEnv): AppConfig {
  const parsed = environmentSchema.safeParse(raw)
  if (!parsed.success)
    throw new ConfigurationError([
      ...new Set(parsed.error.issues.map((issue) => String(issue.path[0] ?? 'environment'))),
    ])
  const data = parsed.data
  return Object.freeze({
    nodeEnv: data.NODE_ENV,
    port: data.PORT,
    host: data.HOST,
    dnsServers: Object.freeze(data.DNS_SERVERS),
    frontendOrigins: Object.freeze([
      ...new Set((data.FRONTEND_ORIGIN ?? localOrigins).split(',').map((value) => value.trim())),
    ]),
    logLevel:
      data.LOG_LEVEL ??
      (data.NODE_ENV === 'test' ? 'silent' : data.NODE_ENV === 'development' ? 'debug' : 'info'),
  })
}
