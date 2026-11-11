import dns from 'node:dns'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ConfigurationError, parseDnsServers, parseEnv } from '../../src/config/env.js'
import { configureDns } from '../../src/config/dns.js'

afterEach(() => vi.restoreAllMocks())

describe('optional process DNS configuration', () => {
  it.each([undefined, '', '   '])('preserves the system resolver when unconfigured', (value) => {
    const setter = vi.spyOn(dns, 'setServers').mockImplementation(() => {})
    const servers = parseDnsServers(value)
    expect(servers).toEqual([])
    configureDns(servers)
    expect(setter).not.toHaveBeenCalled()
  })
  it('validates, trims and deduplicates IPv4 and IPv6 without DNS side effects', () => {
    const setter = vi.spyOn(dns, 'setServers').mockImplementation(() => {})
    const config = parseEnv({ DNS_SERVERS: '8.8.8.8, 2001:4860:4860::8888,8.8.8.8' })
    expect(config.dnsServers).toEqual(['8.8.8.8', '2001:4860:4860::8888'])
    expect(Object.isFrozen(config.dnsServers)).toBe(true)
    expect(setter).not.toHaveBeenCalled()
    configureDns(config.dnsServers)
    expect(setter).toHaveBeenCalledExactlyOnceWith(['8.8.8.8', '2001:4860:4860::8888'])
  })
  it.each([
    'resolver.example',
    'https://8.8.8.8',
    '8.8.8.8:53',
    '[::1]',
    '999.1.1.1',
    '8.8.8.8,',
    ',8.8.8.8',
    '8.8.8.8,,8.8.4.4',
    'fe80::1%eth0',
    Array(9).fill('8.8.8.8').join(','),
  ])('rejects invalid DNS server lists', (value) => {
    expect(() => parseDnsServers(value)).toThrow(ConfigurationError)
    expect(() => parseEnv({ DNS_SERVERS: value })).toThrow('DNS_SERVERS')
  })
  it('sanitizes configuration and runtime resolver failures', () => {
    const marker = 'private-resolver-error'
    try {
      parseDnsServers(marker)
    } catch (error) {
      expect(String(error)).toContain('DNS_SERVERS')
      expect(String(error)).not.toContain(marker)
    }
    vi.spyOn(dns, 'setServers').mockImplementation(() => {
      throw new Error(marker)
    })
    try {
      configureDns(['8.8.8.8'])
      throw new Error('Expected rejection')
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigurationError)
      expect(String(error)).not.toContain(marker)
    }
  })
})
