import { defineConfig } from '@playwright/test';

const isCI = !!process.env.CI;

export const BASE_URL = process.env.BASE_URL ?? 'https://rickandmortyapi.com';
export const GRAPHQL_PATH = '/graphql';
/** Response-time budget for a single query, in milliseconds (generous: public shared service). */
export const MAX_RESPONSE_MS = Number(process.env.MAX_RESPONSE_MS ?? 5000);

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: 1, // a shared public API sheds bursts of parallel requests: keep the load polite
  timeout: 30_000,
  reporter: isCI
    ? [['github'], ['list'], ['html', { open: 'never' }], ['junit', { outputFile: 'playwright-report/junit.xml' }]]
    : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: BASE_URL,
  },
});
