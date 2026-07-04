import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.mjs'],
    // Route/DB tests share a Postgres connection pool per-file; running test
    // files in parallel worker threads is fine since each file uses its own
    // uniquely-named user(s), but we keep a generous timeout since real
    // Postgres round-trips (not mocks) are involved.
    testTimeout: 15000,
    hookTimeout: 15000,
  },
});
