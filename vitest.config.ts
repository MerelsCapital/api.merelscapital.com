import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',

    // More explicit include patterns — this reliably catches src/tests/
    include: [
      'src/tests/**/*.test.ts',
      'src/tests/**/*.spec.ts',
      'src/**/*.test.ts',
      'src/**/*.spec.ts',
    ],

    exclude: [
      'node_modules/**',
      'dist/**',
    ],

    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/**', 'src/tests/**', 'dist/**'],
    },

    fakeTimers: {
      toFake: ['Date', 'setTimeout', 'clearTimeout'],
    },
  },
});