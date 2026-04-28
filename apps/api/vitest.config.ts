import { defineConfig } from 'vitest/config';
import { config } from 'dotenv';
import { resolve } from 'path';

const env = config({ path: resolve(__dirname, '../../.env') }).parsed ?? {};

export default defineConfig({
  test: {
    environment: 'node',
    testTimeout: 10000,
    maxWorkers: 1,
    minWorkers: 1,
    env: {
      ...env,
      DB_NAME: 'trakt_test',
    },
  },
});
