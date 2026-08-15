import { defineConfig, devices } from '@playwright/test';

import { selectedTargets } from './targets';

import type { Target } from './targets';

/** One Playwright for the whole monorepo, run from the root with `yarn e2e`: what it tests is the repo — the
 *  examples a new user is pointed at, the SDK rendering underneath them, and the builder on top. A per-app runner
 *  would only ever see one of those.
 *
 *  The config sits beside the specs rather than at the root so that config, fixtures and specs are all one module
 *  format; a root config is CJS (the root package has no `type`) and would load `targets.ts` as a second, CJS copy
 *  of a file the ESM specs import.
 *
 *  Everything it needs is booted from `targets.ts` — no server has to be running first, and one that already is
 *  gets reused. */

const isCI = !!process.env.CI;

/** Where screenshots and traces land. Out of git: these are things to LOOK at after a run, not baselines to
 *  compare against, so a stable path matters more than a clean one. */
const artifacts = './.artifacts';

/** Readiness is the open port, not a successful GET. The MCP examples answer JSON-RPC and nothing else — `GET /`
 *  is a 405 there by design, which Playwright's URL probe never accepts and would sit retrying until it times out.
 *  A listening socket means the same thing for all of them and misreads none. */
const toWebServer = (target: Target) => ({
  command: `yarn workspace ${target.workspace} start`,
  port: Number(new URL(target.origin).port),
  reuseExistingServer: !isCI,
  timeout: 180_000,
  stdout: 'pipe' as const,
  stderr: 'pipe' as const
});

export default defineConfig({
  testDir: './tests',
  outputDir: `${artifacts}/test-results`,
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: isCI ? 2 : undefined,
  reporter: isCI
    ? [['github'], ['html', { outputFolder: `${artifacts}/report`, open: 'never' }]]
    : [['list'], ['html', { outputFolder: `${artifacts}/report`, open: 'never' }]],
  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
    // The builder serves itself over a locally-minted certificate; nothing here is a real trust decision.
    ignoreHTTPSErrors: true
  },
  projects: [
    {
      name: 'examples',
      testDir: './tests/examples',
      use: { ...devices['Desktop Chrome'] }
    },
    {
      name: 'harness',
      testDir: './tests/harness',
      use: { ...devices['Desktop Chrome'] }
    },
    {
      name: 'builder',
      testDir: './tests/builder',
      use: { ...devices['Desktop Chrome'] }
    }
  ],
  webServer: selectedTargets().map(toWebServer)
});
