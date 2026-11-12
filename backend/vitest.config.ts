import { defineConfig } from 'vitest/config'
export default defineConfig({
  test: {
    environment: 'node',
    clearMocks: true,
    restoreMocks: true,
    testTimeout: 10000,
    hookTimeout: 30000,
    maxWorkers: 1,
    fileParallelism: false,
    // Entrypoint tests deliberately replace process state and must run in a child process.
    // DB tests reuse one thread to bound worker churn around native Argon2 on Windows.
    projects: [
      {
        extends: true,
        test: {
          name: 'process-boundaries',
          include: ['tests/unit/dns-startup.test.ts'],
          pool: 'forks',
        },
      },
      {
        extends: true,
        test: {
          name: 'application',
          include: ['tests/**/*.test.ts'],
          exclude: ['tests/unit/dns-startup.test.ts'],
          pool: 'threads',
          isolate: false,
        },
      },
    ],
  },
})
