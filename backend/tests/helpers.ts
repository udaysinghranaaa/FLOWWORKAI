import { createLogger } from '../src/lib/logger.js'
import { parseEnv } from '../src/config/env.js'
import { createApp, type AppOptions } from '../src/app.js'

export function testConfig(environment: 'test' | 'production' = 'test') {
  return parseEnv({
    NODE_ENV: environment,
    FRONTEND_ORIGIN:
      environment === 'production'
        ? 'https://console.example.com'
        : 'http://localhost:5173,http://127.0.0.1:5173',
    LOG_LEVEL: 'silent',
  })
}
export function testApp(options: Partial<AppOptions> = {}) {
  const config = options.config ?? testConfig()
  return createApp({ config, ...options })
}
export function capturedLogger() {
  const lines: string[] = []
  const logger = createLogger(
    { nodeEnv: 'test', logLevel: 'trace' },
    {
      write: (line) => {
        lines.push(line)
      },
    },
  )
  return {
    logger,
    lines,
    entries: () => lines.map((line) => JSON.parse(line) as Record<string, unknown>),
  }
}
