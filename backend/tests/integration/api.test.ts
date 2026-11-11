import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { testApp, testConfig } from '../helpers.js'

describe('versioned health and example routes', () => {
  it('returns safe health metadata with the canonical envelope and correlated ID', async () => {
    const app = testApp({ now: () => new Date('2026-11-06T10:00:00.000Z') })
    const response = await request(app).get('/api/v1/health').expect(200)
    expect(response.body).toEqual({
      data: {
        status: 'ok',
        service: 'flowwork-ai-api',
        apiVersion: 'v1',
        phase: 3,
        timestamp: '2026-11-06T10:00:00.000Z',
      },
      meta: { requestId: response.headers['x-request-id'] },
    })
    expect(JSON.stringify(response.body)).not.toMatch(
      /database|mongodb|hostname|password|processId/i,
    )
  })
  it('separates liveness from readiness and draining state', async () => {
    const lifecycle = { ready: false, draining: false }
    const app = testApp({ lifecycle })
    await request(app).get('/api/v1/health/live').expect(200)
    expect((await request(app).get('/api/v1/health/ready').expect(503)).body.error.code).toBe(
      'SERVICE_UNAVAILABLE',
    )
    lifecycle.ready = true
    expect((await request(app).get('/api/v1/health/ready').expect(200)).body.data.status).toBe(
      'ready',
    )
    lifecycle.draining = true
    await request(app).get('/api/v1/health/live').expect(200)
    await request(app).get('/api/v1/health').expect(503)
    await request(app).get('/api/v1/example').expect(503)
  })
  it('supports HEAD without a response body', async () => {
    const response = await request(testApp()).head('/api/v1/health').expect(200)
    expect(response.text).toBeUndefined()
    expect(response.headers['x-request-id']).toBeTruthy()
  })
  it.each([
    '/',
    '/health',
    '/api/v2/health',
    '/api/v1/not-here',
    '/api/v1/auth/login',
    '/api/v1/projects',
  ])('does not invent an endpoint at %s', async (path) => {
    const response = await request(testApp()).get(path).expect(404)
    expect(response.body.error).toEqual({
      code: 'NOT_FOUND',
      message: 'Route not found.',
      details: [],
    })
    expect(response.body.meta.requestId).toBe(response.headers['x-request-id'])
  })
  it('provides a deterministic catalog with validated query coercion', async () => {
    const app = testApp()
    const first = await request(app).get('/api/v1/example?limit=2').expect(200)
    expect(first.body.data).toEqual({
      mode: 'development-only',
      items: [
        { code: 'validation', title: 'Validated request boundaries' },
        { code: 'errors', title: 'Consistent operational errors' },
      ],
      persisted: false,
    })
    expect((await request(app).get('/api/v1/example').expect(200)).body.data.items).toHaveLength(3)
    expect((await request(app).get('/api/v1/example/errors').expect(200)).body.data.item.code).toBe(
      'errors',
    )
  })
  it('validates and transforms a body without persisting a record', async () => {
    const response = await request(testApp())
      .post('/api/v1/example/validate')
      .send({ label: '  Useful example  ', count: 2 })
      .expect(200)
    expect(response.body.data).toEqual({
      mode: 'development-only',
      validated: { label: 'Useful example', count: 2, category: 'general' },
      characterCount: 14,
      persisted: false,
    })
    expect(response.body.meta.requestId).toBe(response.headers['x-request-id'])
  })
  it.each([
    {},
    { label: 'Valid label' },
    { label: 4, count: 2 },
    { label: 'a', count: 1 },
    { label: 'Hello', count: '2' },
    { label: 'Hello', count: 0 },
    { label: 'Hello', count: 1.5 },
    { label: 'Hello', count: 101 },
    { label: 'Hello', count: 2, category: 'private' },
    { label: 'Hello', count: 2, role: 'Owner' },
    [],
  ])('rejects invalid body %j consistently with 422', async (body) => {
    const response = await request(testApp())
      .post('/api/v1/example/validate')
      .send(body)
      .expect(422)
    expect(response.body.error.code).toBe('VALIDATION_FAILED')
    expect(response.body.error.details.length).toBeGreaterThan(0)
    expect(
      response.body.error.details.every((detail: { path: string }) =>
        detail.path.startsWith('body'),
      ),
    ).toBe(true)
  })
  it.each(['limit=0', 'limit=4', 'limit=oops', 'limit=1&limit=2', 'limit=', 'unexpected=true'])(
    'rejects invalid query %s without assigning req.query',
    async (query) => {
      expect(
        (await request(testApp()).get(`/api/v1/example?${query}`).expect(422)).body.error.details[0]
          .path,
      ).toMatch(/^query/)
    },
  )
  it('rejects invalid parameters and malformed percent encoding safely', async () => {
    const app = testApp()
    const invalid = await request(app).get('/api/v1/example/not-a-code').expect(422)
    expect(invalid.body.error.details[0].path).toBe('params.code')
    expect((await request(app).get('/api/v1/example/%ZZ').expect(400)).body.error.code).toBe(
      'MALFORMED_URL',
    )
  })
  it('handles malformed JSON, oversized bodies, wrong media types and unsupported encodings', async () => {
    const app = testApp()
    expect(
      (
        await request(app)
          .post('/api/v1/example/validate')
          .set('Content-Type', 'application/json')
          .send('{"label":')
          .expect(400)
      ).body.error.code,
    ).toBe('MALFORMED_JSON')
    expect(
      (
        await request(app)
          .post('/api/v1/example/validate')
          .send({ label: 'x'.repeat(17 * 1024), count: 1 })
          .expect(413)
      ).body.error.code,
    ).toBe('BODY_TOO_LARGE')
    expect(
      (
        await request(app)
          .post('/api/v1/example/validate')
          .set('Content-Type', 'text/plain')
          .send('not JSON')
          .expect(415)
      ).body.error.code,
    ).toBe('UNSUPPORTED_MEDIA_TYPE')
    expect(
      (
        await request(app)
          .post('/api/v1/example/validate')
          .set('Content-Type', 'application/json')
          .set('Content-Encoding', 'gzip')
          .send('{}')
          .expect(415)
      ).body.error.code,
    ).toBe('UNSUPPORTED_MEDIA_TYPE')
  })
  it('does not mount development demonstration routes in production', async () => {
    const app = testApp({ config: testConfig('production') })
    await request(app).get('/api/v1/health').expect(200)
    await request(app).get('/api/v1/example').expect(404)
    await request(app).get('/api/v1/example/errors').expect(404)
    await request(app)
      .post('/api/v1/example/validate')
      .send({ label: 'Example', count: 1 })
      .expect(404)
  })
})
