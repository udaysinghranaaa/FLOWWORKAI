import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApiClient } from './api-client'

const ok = (data: unknown, status = 200) =>
  new Response(JSON.stringify({ data, meta: { requestId: 'test-request' } }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
const failure = (status: number, code: string) =>
  new Response(
    JSON.stringify({
      error: { code, message: 'Safe test failure', details: [] },
      meta: { requestId: 'test-request' },
    }),
    { status },
  )
afterEach(() => vi.useRealTimers())
describe('credentialed authentication client', () => {
  it('bootstraps CSRF and submits registration with credentialed bounded requests', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(ok({ csrfToken: 'test-csrf' }))
      .mockResolvedValueOnce(ok({ deliveryMode: 'development-capture' }, 202))
    const client = createApiClient('http://localhost:5000/api/v1', fetcher)
    await client.register('Test Person', 'person@example.com', 'Test passphrase 123!')
    expect(fetcher.mock.calls[0]?.[0]).toBe('http://localhost:5000/api/v1/auth/csrf')
    expect(fetcher.mock.calls[1]?.[1]).toMatchObject({
      method: 'POST',
      credentials: 'include',
      headers: { 'X-CSRF-Token': 'test-csrf' },
    })
    expect(localStorage.getItem('accessToken')).toBeNull()
    expect(localStorage.getItem('refreshToken')).toBeNull()
  })
  it('does not refresh invalid login credentials or loop on a denied refresh', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(ok({ csrfToken: 'test-csrf' }))
      .mockResolvedValueOnce(failure(401, 'INVALID_CREDENTIALS'))
    const client = createApiClient('http://localhost:5000/api/v1', fetcher)
    await expect(client.login('person@example.com', 'bad')).rejects.toMatchObject({
      status: 401,
      code: 'INVALID_CREDENTIALS',
    })
    expect(fetcher).toHaveBeenCalledTimes(2)
  })
  it('deduplicates simultaneous refreshes and retries each original read once', async () => {
    let rotated = false
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async (input) => {
      const path = String(input)
      if (path.endsWith('/csrf')) return ok({ csrfToken: 'test-csrf' })
      if (path.endsWith('/refresh')) {
        await Promise.resolve()
        rotated = true
        return ok({ csrfToken: 'rotated-csrf' })
      }
      return rotated ? ok({ user: { id: 'test-user' } }) : failure(401, 'UNAUTHENTICATED')
    })
    const client = createApiClient('http://localhost:5000/api/v1', fetcher)
    const results = await Promise.all([client.currentUser(), client.currentUser()])
    expect(results.map((user) => user.id)).toEqual(['test-user', 'test-user'])
    expect(fetcher.mock.calls.filter((call) => String(call[0]).endsWith('/refresh'))).toHaveLength(
      1,
    )
  })
  it('stops after a refresh failure and propagates session expiration', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockImplementation(async (input) =>
        String(input).endsWith('/csrf')
          ? ok({ csrfToken: 'test-csrf' })
          : failure(401, 'UNAUTHENTICATED'),
      )
    await expect(
      createApiClient('http://localhost:5000/api/v1', fetcher).currentUser(),
    ).rejects.toMatchObject({ status: 401 })
    expect(fetcher.mock.calls.filter((call) => String(call[0]).endsWith('/refresh'))).toHaveLength(
      1,
    )
  })
  it('rebootstraps CSRF once after another tab rotates the cookie', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(ok({ csrfToken: 'old-csrf' }))
      .mockResolvedValueOnce(failure(403, 'CSRF_INVALID'))
      .mockResolvedValueOnce(ok({ csrfToken: 'new-csrf' }))
      .mockResolvedValueOnce(ok({ user: { id: 'test-user' } }))
    await createApiClient('http://localhost:5000/api/v1', fetcher).login(
      'person@example.com',
      'Test passphrase 123!',
    )
    expect(fetcher.mock.calls[3]?.[1]?.headers).toMatchObject({ 'X-CSRF-Token': 'new-csrf' })
    expect(fetcher).toHaveBeenCalledTimes(4)
  })
  it('sanitizes network errors instead of exposing underlying exception values', async () => {
    const fetcher = vi.fn<typeof fetch>().mockRejectedValue(new Error('private diagnostic'))
    await expect(
      createApiClient('http://localhost:5000/api/v1', fetcher).currentUser(),
    ).rejects.toMatchObject({
      status: 0,
      code: 'NETWORK_ERROR',
      message: 'Cannot reach the server. Check your connection and try again.',
    })
  })
  it('aborts on the configured deadline without retrying a mutation', async () => {
    vi.useFakeTimers()
    const fetcher = vi.fn<typeof fetch>().mockImplementation(
      async (_input, options) =>
        new Promise((_resolve, reject) => {
          options?.signal?.addEventListener('abort', () => reject(new Error('aborted')))
        }),
    )
    const operation = createApiClient('http://localhost:5000/api/v1', fetcher).request('/health')
    const expected = expect(operation).rejects.toMatchObject({ code: 'REQUEST_ABORTED' })
    await vi.advanceTimersByTimeAsync(10001)
    await expected
    expect(fetcher).toHaveBeenCalledTimes(1)
  })
  it('clears in-memory CSRF on confirmed logout', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockImplementation(async (input) =>
        String(input).endsWith('/csrf')
          ? ok({ csrfToken: 'test-csrf' })
          : new Response(null, { status: 204 }),
      )
    const client = createApiClient('http://localhost:5000/api/v1', fetcher)
    await client.logout()
    await client.logout()
    expect(fetcher.mock.calls.filter((call) => String(call[0]).endsWith('/csrf'))).toHaveLength(2)
  })
})
