import { defineConfig } from '@playwright/test';

/** One command from a cold checkout: Playwright starts the example itself, on a port of its own. */
export default defineConfig({
  testDir: './test',
  outputDir: './test/.results',
  use: { baseURL: 'http://127.0.0.1:4103' },
  webServer: { command: 'PORT=4103 yarn start', url: 'http://127.0.0.1:4103', reuseExistingServer: true }
});
