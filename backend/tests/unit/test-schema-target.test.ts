import { describe, it, expect } from 'vitest'
import { assertIsolatedSchemaTarget } from '../../src/lib/test-schema-target.js'
describe('automatic test schema boundary', () => {
  it.each(['flowwork_test_' + 'a'.repeat(32), 'flowwork_test_e2e_' + 'b'.repeat(32)])(
    'accepts generated loopback namespace %s',
    (name) => expect(() => assertIsolatedSchemaTarget({ host: '127.0.0.1', name })).not.toThrow(),
  )
  it.each([
    { host: 'private-cluster.example', name: 'flowwork_test_' + 'a'.repeat(32) },
    { host: '127.0.0.1', name: 'customer_database' },
    { host: '127.0.0.1', name: 'flowwork_test_not_generated' },
  ])('rejects an unisolated schema target without exposing it', (target) => {
    expect(() => assertIsolatedSchemaTarget(target)).toThrow(
      'Test schema initialization requires a generated loopback database.',
    )
    try {
      assertIsolatedSchemaTarget(target)
    } catch (error) {
      expect(String(error)).not.toContain(target.name)
      expect(String(error)).not.toContain(target.host)
    }
  })
})
