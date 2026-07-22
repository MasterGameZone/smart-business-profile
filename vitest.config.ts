import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  test: {
    clearMocks: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: 'coverage',
    },
    environment: 'jsdom',
    globals: false,
    restoreMocks: true,
    setupFiles: ['./src/test/setup.ts'],
  },
})
