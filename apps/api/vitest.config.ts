import { defineConfig } from 'vitest/config';
import { config } from 'dotenv';
import { resolve } from 'path';

const env = config({ path: resolve(__dirname, '../../.env') }).parsed ?? {};

export default defineConfig({
  resolve: {
    alias: {
      '@trakt/types': resolve(__dirname, '../../packages/types/src/index.ts'),
    },
  },
  test: {
    environment: 'node',
    testTimeout: 10000,
    maxWorkers: 4,
    minWorkers: 1,
    globalSetup: './src/test/globalSetup.ts',
    globalTeardown: './src/test/globalTeardown.ts',
    env: {
      ...env,
    },
  },
});
