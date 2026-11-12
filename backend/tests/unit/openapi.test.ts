import { readFile } from 'node:fs/promises'
import SwaggerParser from '@apidevtools/swagger-parser'
import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { testApp } from '../helpers.js'

describe('implemented OpenAPI contract', () => {
  it('validates OpenAPI 3 structure and local references without fetching external resources', async () => {
    const document = await SwaggerParser.validate('openapi.json', { resolve: { external: false } })
    expect('openapi' in document && document.openapi).toBe('3.0.3')
    expect(Object.keys(document.paths ?? {})).toHaveLength(32)
    expect(Object.keys(document.paths ?? {})).not.toContain('/api/v1/workspaces')
  })
  it('documents each operational method/path and the preserved Phase 1 envelope', async () => {
    const document = JSON.parse(await readFile('openapi.json', 'utf8')) as {
      paths: Record<string, Record<string, { responses: Record<string, unknown> }>>
    }
    for (const [method, path] of [
      ['get', '/api/v1/health'],
      ['get', '/api/v1/health/live'],
      ['get', '/api/v1/health/ready'],
      ['get', '/api/v1/example'],
      ['get', '/api/v1/example/validation'],
      ['post', '/api/v1/example/validate'],
    ] as const) {
      const documentedPath = path === '/api/v1/example/validation' ? '/api/v1/example/{code}' : path
      expect(document.paths[documentedPath]?.[method]?.responses['200']).toBeTruthy()
      const client = request(testApp())
      const response =
        method === 'get'
          ? await client.get(path).expect(200)
          : await client.post(path).send({ label: 'Contract example', count: 1 }).expect(200)
      expect(Object.keys(response.body).sort()).toEqual(['data', 'meta'])
      expect(response.body.meta.requestId).toBe(response.headers['x-request-id'])
    }
  })
})
