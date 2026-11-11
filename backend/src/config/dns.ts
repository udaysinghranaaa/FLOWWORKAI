import dns from 'node:dns'
import { ConfigurationError } from './env.js'

/** Call once during process startup, before any driver connection/SRV/TXT lookup. */
export function configureDns(servers: readonly string[]): void {
  if (servers.length === 0) return
  try {
    dns.setServers([...servers])
  } catch {
    throw new ConfigurationError(['DNS_SERVERS'])
  }
}
