import { describe, expect, it } from 'vitest'
import { ConfigurationError, parseEnv } from '../../src/config/env.js'

describe('validated environment boundaries', () => {
  it('uses bounded local defaults and returns only explicit configuration fields', () => {
    const config = parseEnv({ UNRELATED_SECRET: 'not-for-configuration' })
    expect(config).toEqual({
      nodeEnv: 'development',
      port: 5000,
      host: '127.0.0.1',
      frontendOrigins: ['http://localhost:5173', 'http://127.0.0.1:5173'],
      logLevel: 'debug',
      dnsServers: [],
    })
    expect(JSON.stringify(config)).not.toContain('not-for-configuration')
    expect(Object.isFrozen(config)).toBe(true)
  })
  it('normalizes a deduplicated explicit origin allowlist', () => {
    expect(
      parseEnv({
        NODE_ENV: 'production',
        PORT: '5055',
        HOST: '0.0.0.0',
        FRONTEND_ORIGIN: 'https://one.example, https://two.example,https://one.example',
        LOG_LEVEL: 'warn',
      }),
    ).toEqual({
      nodeEnv: 'production',
      port: 5055,
      host: '0.0.0.0',
      frontendOrigins: ['https://one.example', 'https://two.example'],
      logLevel: 'warn',
      dnsServers: [],
    })
  })
  it.each(['', '0', '-1', '65536', '5.5', '5000oops'])('rejects invalid PORT %j', (PORT) => {
    expect(() => parseEnv({ PORT })).toThrow(ConfigurationError)
  })
  it.each([
    '*',
    'null',
    'http://localhost:5173/',
    'https://site.example/path',
    'https://user:password@site.example',
    'https://site.example?secret=one',
    'ftp://site.example',
    'https://site.example,',
  ])('rejects non-origin FRONTEND_ORIGIN %j', (FRONTEND_ORIGIN) => {
    expect(() => parseEnv({ FRONTEND_ORIGIN })).toThrow(ConfigurationError)
  })
  it('requires explicit HTTPS origins for production', () => {
    expect(() => parseEnv({ NODE_ENV: 'production' })).toThrow('FRONTEND_ORIGIN')
    expect(() =>
      parseEnv({ NODE_ENV: 'production', FRONTEND_ORIGIN: 'http://localhost:5173' }),
    ).toThrow('FRONTEND_ORIGIN')
  })
  it('rejects bad environment/log/host values without echoing any supplied value', () => {
    const marker = 'secret-value-must-not-appear'
    try {
      parseEnv({ NODE_ENV: marker, LOG_LEVEL: marker, HOST: marker })
      throw new Error('Expected parsing failure')
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigurationError)
      expect((error as ConfigurationError).fields).toEqual(['NODE_ENV', 'HOST', 'LOG_LEVEL'])
      expect(String(error)).not.toContain(marker)
    }
  })
  it('accepts unbracketed IPv6 bind addresses and keeps tests silent by default', () => {
    expect(parseEnv({ NODE_ENV: 'test', HOST: '::1' }).logLevel).toBe('silent')
  })
})
