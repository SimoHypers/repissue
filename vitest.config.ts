import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    extensions: ['.ts', '.js'],
  },
  test: {
    globals: true,
    environment: 'node',
    // Default run: unit tests only. Use `vitest run --project integration` for the full suite.
    include: ['tests/**/*.test.ts'],
    exclude: ['tests/integration/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**'],
      exclude: ['src/index.ts'],
    },
  },
});