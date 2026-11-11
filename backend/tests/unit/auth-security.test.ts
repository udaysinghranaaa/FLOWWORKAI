import { randomBytes } from 'node:crypto'
import type { Response } from 'express'
import { describe, expect, it, vi } from 'vitest'
import { parseAuthEnv } from '../../src/config/auth-env.js'
import { cookiePolicy } from '../../src/modules/auth/auth.cookies.js'
import { createAccessTokens } from '../../src/modules/auth/auth.crypto.js'
import { createMailAdapter } from '../../src/lib/mail.js'
import { assertSafeTestDatabase } from '../auth-fixture.js'
import { testConfig } from '../helpers.js'

const raw = () => ({
  MONGODB_URI: 'mongodb://127.0.0.1:27017/flowwork_test_unit',
  JWT_SECRET: randomBytes(32).toString('hex'),
})
describe('authentication configuration, production cookie policy and test safety', () => {
  it.each(['MONGODB_URI', 'JWT_SECRET'] as const)('rejects missing %s with names only', (field) => {
    const values: NodeJS.ProcessEnv = raw()
    delete values[field]
    expect(() => parseAuthEnv(values, testConfig())).toThrow(field)
  })
  it('rejects invalid credentials without disclosing their values', () => {
    const values = { MONGODB_URI: 'invalid-private-value', JWT_SECRET: 'private-short-key' }
    try {
      parseAuthEnv(values, testConfig())
      throw new Error('Expected configuration rejection')
    } catch (error) {
      expect(String(error)).not.toMatch(/invalid-private-value|private-short-key/)
      expect(String(error)).toContain('JWT_SECRET')
    }
  })
  it('requires explicit SMTP configuration in production', () => {
    expect(() => parseAuthEnv(raw(), testConfig('production'))).toThrow('MAIL_MODE')
    expect(() => parseAuthEnv({ ...raw(), MAIL_MODE: 'smtp' }, testConfig('production'))).toThrow(
      'SMTP_HOST',
    )
  })
  it('sets and clears production host-only Secure HttpOnly Lax cookies with matching paths', () => {
    const config = { ...parseAuthEnv(raw(), testConfig()), secureCookies: true }
    const cookies = cookiePolicy(config)
    const response = { cookie: vi.fn(), clearCookie: vi.fn() } as unknown as Response
    cookies.set(response, 'access', 'controlled-test-value', 600000)
    expect(response.cookie).toHaveBeenCalledWith('__Host-fw_access', 'controlled-test-value', {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 600000,
    })
    cookies.clear(response)
    expect(response.clearCookie).toHaveBeenCalledWith('__Host-fw_access', {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
    })
  })
  it('forbids production mail capture', () => {
    expect(() =>
      createMailAdapter({ ...parseAuthEnv(raw(), testConfig()), secureCookies: true }),
    ).toThrow('forbidden')
  })
  it.each([
    ['mongodb://example.com/flowwork_test_unit', 'test', 'flowwork_test_unit'],
    ['mongodb://127.0.0.1/customer_data', 'test', 'customer_data'],
    ['mongodb://127.0.0.1/flowwork_test_unit', 'production', 'flowwork_test_unit'],
    ['mongodb+srv://example.com/flowwork_test_unit', 'test', 'flowwork_test_unit'],
    ['mongodb://127.0.0.1/other', 'test', 'flowwork_test_unit'],
  ])('refuses unsafe cleanup configuration', (uri, environment, name) => {
    expect(() => assertSafeTestDatabase(uri, environment, name)).toThrow('Refusing unsafe')
  })
  it('accepts only an explicitly named loopback test database', () => {
    expect(() =>
      assertSafeTestDatabase(
        'mongodb://127.0.0.1/flowwork_test_unit',
        'test',
        'flowwork_test_unit',
      ),
    ).not.toThrow()
  })
  it('signs minimal short-lived access credentials and verifies the exact claims', async () => {
    const config = parseAuthEnv(raw(), testConfig()),
      tokens = createAccessTokens(config)
    const token = await tokens.sign('a'.repeat(24), 'b'.repeat(24), 2)
    expect(await tokens.verify(token)).toEqual({
      userId: 'a'.repeat(24),
      sessionId: 'b'.repeat(24),
      version: 2,
    })
    const payload = JSON.parse(Buffer.from(token.split('.')[1]!, 'base64url').toString()) as Record<
      string,
      unknown
    >
    expect(Object.keys(payload).sort()).toEqual([
      'aud',
      'exp',
      'iat',
      'iss',
      'sid',
      'sub',
      'sv',
      'tokenType',
    ])
    expect(Number(payload.exp) - Number(payload.iat)).toBe(600)
  })
})
