export function assertSafeTestDatabase(uri: string, environment: string, name: string) {
  const url = new URL(uri)
  if (
    environment !== 'test' ||
    !['127.0.0.1', 'localhost'].includes(url.hostname) ||
    url.protocol !== 'mongodb:' ||
    !/^flowwork_test_[a-z0-9_]+$/.test(name) ||
    url.pathname !== `/${name}`
  )
    throw new Error('Refusing unsafe test database configuration.')
}
