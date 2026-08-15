import path from 'node:path';

import { defineConfig, devices } from '@playwright/test';

import { categories } from './categories';
import { selectedTargets } from './targets';

import type { Target } from './targets';

/** One Playwright for the whole monorepo, run from the root with `yarn e2e`.
 *
 *  It is cut one category per app — `sdk`, `server`, `mcp`, `builder`, plus `cross` and `examples` — each of which
 *  is a Playwright project, so `yarn e2e --project=server` runs one app and starts only the servers that app
 *  declares. Sub-categories are the directories inside. See `categories.ts`.
 *
 *  The config sits beside the specs rather than at the repo root so that config, fixtures and specs are all one
 *  module format; a root config is CJS (the root package has no `type`) and would load `targets.ts` as a second,
 *  CJS copy of a file the ESM specs import. */

const isCI = !!process.env.CI;

/** Where screenshots and traces land. Out of git: these are things to LOOK at after a run, not baselines to
 *  compare against, so a stable path matters more than a clean one. */
const artifacts = './.artifacts';

/** Readiness is the open port, not a successful GET. An MCP server answers JSON-RPC and nothing else — `GET /` is
 *  a 405 there by design, which Playwright's URL probe never accepts and would sit retrying until it times out. A
 *  listening socket means the same thing for all of them and misreads none. */
const toWebServer = (target: Target) => ({
  command: target.command ?? `yarn workspace ${target.workspace} start`,
  port: Number(new URL(target.origin).port),
  reuseExistingServer: !isCI,
  timeout: 180_000,
  stdout: 'pipe' as const,
  stderr: 'pipe' as const
});

const servers = selectedTargets();

/** Playwright says nothing at all while it starts these, and until they are up it has nothing to show — an empty
 *  test list that looks broken rather than busy. One line, so the wait is legible.
 *
 *  Only from the process that actually starts them: workers re-load this config, and a worker's copy of the list
 *  is not what is running. */
if (process.env.TEST_WORKER_INDEX === undefined) {
  console.log(`[e2e] starting ${servers.length} server(s): ${servers.map(server => server.id).join(', ')}`);
}

export default defineConfig({
  // No top-level `testDir`: every project declares its own, and a parent that also claims the whole tree makes
  // UI mode attribute files to the wrong project.
  outputDir: `${artifacts}/test-results`,
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: isCI ? 2 : undefined,
  reporter: isCI
    ? [['github'], ['html', { outputFolder: `${artifacts}/report`, open: 'never' }]]
    : [['list'], ['html', { outputFolder: `${artifacts}/report`, open: 'never' }]],
  use: {
    /** The DOM the UI replays in its right-hand pane comes from the trace, and a trace kept only on failure means
     *  a test that PASSED has nothing to show — the pane sits on `about:blank` and the run looks invisible.
     *  Locally that is the whole point of watching, so record always; CI has no one watching and keeps the ones
     *  that failed. */
    trace: isCI ? 'retain-on-failure' : 'on',
    screenshot: 'only-on-failure',
    video: 'off',
    // The builder serves itself over a locally-minted certificate; nothing here is a real trust decision.
    ignoreHTTPSErrors: true,
    ...devices['Desktop Chrome']
  },
  // Absolute: a relative testDir is resolved against the config's directory by the CLI and against the watcher's
  // cwd by UI mode, and the two are not the same place.
  projects: categories.map(category => ({
    name: category.name,
    testDir: path.resolve(import.meta.dirname, 'tests', category.name)
  })),
  webServer: servers.map(toWebServer)
});
