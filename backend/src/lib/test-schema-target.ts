/** Automatic schema provisioning is reserved for generated local test databases. */
export function assertIsolatedSchemaTarget(target: { host: string; name: string }): void {
  if (target.host !== '127.0.0.1' || !/^flowwork_test_(?:e2e_)?[a-f0-9]{32}$/.test(target.name))
    throw new Error('Test schema initialization requires a generated loopback database.')
}
