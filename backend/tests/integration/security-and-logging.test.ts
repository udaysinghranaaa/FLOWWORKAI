import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { testApp, testConfig, capturedLogger } from '../helpers.js'
import { createExampleService } from '../../src/modules/example/example.service.js'
import { ApiError } from '../../src/lib/api-error.js'

describe('request IDs, security middleware and logging', () => {
  it('creates unique UUIDs and propagates a bounded valid identifier', async () => {
    const app = testApp()
    const id = '123e4567-e89b-42d3-a456-426614174000'
    const one = await request(app).get('/api/v1/health').expect(200)
    const two = await request(app).get('/api/v1/health').expect(200)
    expect(one.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/)
    expect(two.headers['x-request-id']).not.toBe(one.headers['x-request-id'])
    const supplied = await request(app)
      .get('/api/v1/health')
      .set('X-Request-ID', id.toUpperCase())
      .expect(200)
    expect(supplied.headers['x-request-id']).toBe(id)
    expect(supplied.body.meta.requestId).toBe(id)
  })
  it.each(['bad', 'x'.repeat(500)])('replaces invalid request ID %j', async (id) => {
    const response = await request(testApp())
      .get('/api/v1/health')
      .set('X-Request-ID', id)
      .expect(200)
    expect(response.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/)
    expect(response.headers['x-request-id']).not.toBe(id)
  })
  it('sets Helmet and no-store headers on success and failure without exposing Express', async () => {
    for (const path of ['/api/v1/health', '/unknown']) {
      const response = await request(testApp()).get(path)
      expect(response.headers['x-content-type-options']).toBe('nosniff')
      expect(response.headers['x-frame-options']).toBe('SAMEORIGIN')
      expect(response.headers['content-security-policy']).toContain("default-src 'self'")
      expect(response.headers['cache-control']).toBe('no-store')
      expect(response.headers['x-powered-by']).toBeUndefined()
      expect(response.headers['strict-transport-security']).toBeUndefined()
    }
    expect(
      (await request(testApp({ config: testConfig('production') })).get('/api/v1/health')).headers[
        'strict-transport-security'
      ],
    ).toContain('max-age=31536000')
  })
  it('allows exact configured origins and bounded preflight without credentials', async () => {
    const app = testApp()
    const origin = 'http://localhost:5173'
    const allowed = await request(app).get('/api/v1/health').set('Origin', origin).expect(200)
    expect(allowed.headers['access-control-allow-origin']).toBe(origin)
    expect(allowed.headers['access-control-allow-credentials']).toBeUndefined()
    expect(allowed.headers.vary).toContain('Origin')
    expect(allowed.headers['access-control-expose-headers']).toContain('X-Request-ID')
    const preflight = await request(app)
      .options('/api/v1/example/validate')
      .set('Origin', origin)
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'content-type,x-request-id')
      .expect(204)
    expect(preflight.headers['access-control-allow-methods']).toBe('GET,HEAD,POST,OPTIONS')
    expect(preflight.headers['x-request-id']).toBeTruthy()
    expect(preflight.headers['x-content-type-options']).toBe('nosniff')
  })
  it.each(['https://evil.example', 'http://localhost:5173.evil.example', 'null'])(
    'rejects untrusted Origin %s safely',
    async (origin) => {
      const response = await request(testApp())
        .get('/api/v1/health')
        .set('Origin', origin)
        .expect(403)
      expect(response.body.error.code).toBe('CORS_ORIGIN_DENIED')
      expect(response.headers['access-control-allow-origin']).toBeUndefined()
      expect(response.body.meta.requestId).toBe(response.headers['x-request-id'])
    },
  )
  it('allows no-Origin clients and production configured HTTPS origins', async () => {
    await request(testApp()).get('/api/v1/health').expect(200)
    const response = await request(testApp({ config: testConfig('production') }))
      .get('/api/v1/health')
      .set('Origin', 'https://console.example.com')
      .expect(200)
    expect(response.headers['access-control-allow-origin']).toBe('https://console.example.com')
  })
  it('rate limits each app, ignores spoofed proxy headers, and exempts health probes', async () => {
    const app = testApp({ rateLimit: { limit: 2, windowMs: 60_000 } })
    await request(app).get('/api/v1/health').expect(200)
    await request(app).get('/api/v1/example').set('X-Forwarded-For', '198.51.100.1').expect(200)
    await request(app).get('/api/v1/example').set('X-Forwarded-For', '198.51.100.2').expect(200)
    const limited = await request(app)
      .get('/api/v1/example')
      .set('X-Forwarded-For', '198.51.100.3')
      .expect(429)
    expect(limited.body.error.code).toBe('RATE_LIMITED')
    expect(limited.headers['retry-after']).toBeTruthy()
    expect(limited.headers.ratelimit).toBeTruthy()
    expect(limited.headers['ratelimit-policy']).toBeTruthy()
    await request(app).get('/api/v1/health/ready').expect(200)
    await request(testApp({ rateLimit: { limit: 2 } }))
      .get('/api/v1/example')
      .expect(200)
    expect(app.get('trust proxy')).toBe(false)
  })
  it('correlates method/path/status/duration logs while excluding sensitive input', async () => {
    const capture = capturedLogger()
    const app = testApp({ logger: capture.logger })
    const id = '123e4567-e89b-42d3-a456-426614174000'
    const secret = 'private-marker-not-for-logs'
    await request(app)
      .get(`/api/v1/example?limit=2&secret=${secret}`)
      .set('Authorization', `Bearer ${secret}`)
      .set('Cookie', `session=${secret}`)
      .set('X-Request-ID', id)
      .expect(422)
    await request(app)
      .post('/api/v1/example/validate')
      .send({ label: secret, count: 1 })
      .expect(200)
    const entry = capture.entries().find((line) => line.requestId === id)
    expect(entry).toMatchObject({
      req: { method: 'GET' },
      res: { statusCode: 422 },
      path: '/api/v1/example',
      errorCode: 'VALIDATION_FAILED',
    })
    expect(typeof entry?.responseTime).toBe('number')
    expect(capture.lines.join('')).not.toContain(secret)
    expect(capture.lines.join('')).not.toMatch(/Bearer|session=|secret=/)
  })
  it('sanitizes unexpected exceptions in all environments but keeps safe diagnostics', async () => {
    const secret = 'upstream-credential-must-not-leak'
    for (const config of [testConfig(), testConfig('production')]) {
      const capture = capturedLogger()
      const app = testApp({
        config,
        logger: capture.logger,
        now: () => {
          throw new Error(secret)
        },
      })
      const response = await request(app).get('/api/v1/health').expect(500)
      expect(response.body.error).toEqual({
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred.',
        details: [],
      })
      expect(JSON.stringify(response.body)).not.toMatch(/stack|upstream-credential/)
      expect(capture.lines.join('')).not.toContain(secret)
      expect(capture.entries().some((line) => line.diagnostic)).toBe(true)
    }
  })
  it('forwards async service rejection into the centralized handler once', async () => {
    const capture = capturedLogger()
    const service = createExampleService()
    const app = testApp({
      logger: capture.logger,
      exampleService: {
        ...service,
        list: async () => {
          throw new ApiError(503, 'SERVICE_UNAVAILABLE', 'The example dependency is unavailable.')
        },
      },
    })
    expect((await request(app).get('/api/v1/example').expect(503)).body.error.code).toBe(
      'SERVICE_UNAVAILABLE',
    )
    expect(capture.entries().filter((line) => line.msg === 'HTTP request failed')).toHaveLength(1)
  })
  it('does not echo sensitive malformed-body fragments in response or logs', async () => {
    const capture = capturedLogger()
    const secret = 'sensitive-malformed-body'
    const response = await request(testApp({ logger: capture.logger }))
      .post('/api/v1/example/validate')
      .set('Content-Type', 'application/json')
      .send(`{"${secret}":`)
      .expect(400)
    expect(JSON.stringify(response.body)).not.toContain(secret)
    expect(capture.lines.join('')).not.toContain(secret)
  })
})
