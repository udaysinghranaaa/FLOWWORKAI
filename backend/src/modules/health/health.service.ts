import { ApiError } from '../../lib/api-error.js'

export interface LifecycleState {
  ready: boolean
  draining: boolean
}
export interface HealthData {
  status: 'ok' | 'alive' | 'ready'
  service: 'flowwork-ai-api'
  apiVersion: 'v1'
  phase: 3 | 4
  timestamp: string
}

export function createHealthService(
  lifecycle: LifecycleState,
  now: () => Date = () => new Date(),
  dependenciesReady: () => boolean = () => true,
  phase: 3 | 4 = 3,
) {
  function report(status: HealthData['status']): HealthData {
    return {
      status,
      service: 'flowwork-ai-api',
      apiVersion: 'v1',
      phase,
      timestamp: now().toISOString(),
    }
  }
  function assertReady() {
    if (!lifecycle.ready || lifecycle.draining || !dependenciesReady())
      throw new ApiError(503, 'SERVICE_UNAVAILABLE', 'The service is not accepting new work.')
  }
  return {
    health: () => {
      assertReady()
      return report('ok')
    },
    live: () => report('alive'),
    ready: () => {
      assertReady()
      return report('ready')
    },
  }
}
export type HealthService = ReturnType<typeof createHealthService>
