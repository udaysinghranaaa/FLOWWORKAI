export interface AuthUser {
  id: string
  name: string
  email: string
  avatarUrl: string | null
  emailVerified: boolean
  accountStatus: string
}
export class ApiClientError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly requestId?: string,
    public readonly details: { path: string; message: string }[] = [],
  ) {
    super(message)
    this.name = 'ApiClientError'
  }
}
interface RequestOptions {
  method?: 'GET' | 'POST'
  body?: unknown
  signal?: AbortSignal
  refresh?: boolean
}

export function createApiClient(
  baseUrl: string,
  fetcher: typeof fetch = (...args) => fetch(...args),
) {
  let csrfToken: string | undefined
  let csrfPromise: Promise<string> | undefined
  let refreshPromise: Promise<void> | undefined
  async function raw<T>(path: string, options: RequestOptions = {}, csrf?: string): Promise<T> {
    const controller = new AbortController()
    const abort = () => controller.abort()
    options.signal?.addEventListener('abort', abort, { once: true })
    if (options.signal?.aborted) controller.abort()
    const timer = setTimeout(abort, 10000)
    try {
      const response = await fetcher(`${baseUrl.replace(/\/$/, '')}${path}`, {
        method: options.method ?? 'GET',
        credentials: 'include',
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
          ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
          ...(csrf ? { 'X-CSRF-Token': csrf } : {}),
        },
        ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
      })
      if (response.status === 204) return undefined as T
      const payload = (await response.json()) as {
        data: T & { csrfToken?: string }
        error?: { code: string; message: string; details?: { path: string; message: string }[] }
        meta?: { requestId?: string }
      }
      if (!response.ok)
        throw new ApiClientError(
          response.status,
          payload.error?.code ?? 'REQUEST_FAILED',
          payload.error?.message ?? 'The request could not be completed.',
          payload.meta?.requestId,
          payload.error?.details,
        )
      if (payload.data?.csrfToken) csrfToken = payload.data.csrfToken
      return payload.data
    } catch (error) {
      if (error instanceof ApiClientError) throw error
      throw new ApiClientError(
        0,
        controller.signal.aborted ? 'REQUEST_ABORTED' : 'NETWORK_ERROR',
        controller.signal.aborted
          ? 'The request timed out or was cancelled. Try again.'
          : 'Cannot reach the server. Check your connection and try again.',
      )
    } finally {
      clearTimeout(timer)
      options.signal?.removeEventListener('abort', abort)
    }
  }
  async function csrf(force = false): Promise<string> {
    if (force) csrfToken = undefined
    if (csrfToken) return csrfToken
    if (!csrfPromise)
      csrfPromise = raw<{ csrfToken: string }>('/auth/csrf')
        .then((result) => result.csrfToken)
        .finally(() => {
          csrfPromise = undefined
        })
    return csrfPromise
  }
  async function perform<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const unsafe = options.method === 'POST'
    try {
      return await raw<T>(path, options, unsafe ? await csrf() : undefined)
    } catch (error) {
      if (unsafe && error instanceof ApiClientError && error.code === 'CSRF_INVALID')
        return raw<T>(path, options, await csrf(true))
      throw error
    }
  }
  async function refreshSession(): Promise<void> {
    if (!refreshPromise) {
      const rotate = async () => {
        // Another tab may have rotated while this tab waited for the lock.
        try {
          await raw('/auth/me')
          return
        } catch (error) {
          if (!(error instanceof ApiClientError) || error.status !== 401) throw error
        }
        await perform('/auth/refresh', { method: 'POST', body: {} })
      }
      const coordinated = async () => {
        if (typeof navigator !== 'undefined' && navigator.locks)
          await navigator.locks.request('flowwork-refresh', rotate)
        else await rotate()
      }
      refreshPromise = coordinated().finally(() => {
        refreshPromise = undefined
      })
    }
    return refreshPromise
  }
  async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    try {
      return await perform<T>(path, options)
    } catch (error) {
      if (error instanceof ApiClientError && error.status === 401 && options.refresh !== false) {
        await refreshSession()
        return perform<T>(path, { ...options, refresh: false })
      }
      throw error
    }
  }
  return {
    request,
    currentUser: async () => (await request<{ user: AuthUser }>('/auth/me')).user,
    login: (email: string, password: string) =>
      request<{ user: AuthUser }>('/auth/login', {
        method: 'POST',
        body: { email, password },
        refresh: false,
      }),
    register: (name: string, email: string, password: string) =>
      request<{ deliveryMode: string }>('/auth/register', {
        method: 'POST',
        body: { name, email, password },
        refresh: false,
      }),
    logout: async (all = false) => {
      await request(`/auth/${all ? 'logout-all' : 'logout'}`, {
        method: 'POST',
        body: {},
        refresh: all,
      })
      csrfToken = undefined
    },
    forgot: (email: string) =>
      request<{ deliveryMode: string }>('/auth/forgot-password', {
        method: 'POST',
        body: { email },
        refresh: false,
      }),
    resend: (email: string) =>
      request<{ deliveryMode: string }>('/auth/resend-verification', {
        method: 'POST',
        body: { email },
        refresh: false,
      }),
    verify: (token: string) =>
      request('/auth/verify-email', { method: 'POST', body: { token }, refresh: false }),
    reset: (token: string, password: string) =>
      request('/auth/reset-password', {
        method: 'POST',
        body: { token, password },
        refresh: false,
      }),
  }
}
const defaultHost =
  typeof window !== 'undefined' && window.location.hostname === 'localhost'
    ? 'localhost'
    : '127.0.0.1'
export const api = createApiClient(
  import.meta.env.VITE_API_BASE_URL ||
    (import.meta.env.PROD ? '/api/v1' : `http://${defaultHost}:5000/api/v1`),
)
