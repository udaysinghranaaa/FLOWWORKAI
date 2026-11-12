import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    clearMocks: true,
    restoreMocks: true,
    testTimeout: 10000,
    // Replica-set fixtures and native password hashing run predictably on Windows.
    maxWorkers: 1,
  },
})
