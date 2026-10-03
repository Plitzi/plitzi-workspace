import path from 'node:path';

import { defineConfig, devices } from '@playwright/test';

import { backendSummary } from './backend';
import { categories } from './categories';
import { LAUNCH_TARGETS_ENV, LAUNCHER_PORT } from './launchConfig';
import { selectedTargets } from './targets';
import { WARM_UP_ENV } from './warmUp';

const WARM_UP = 'warm-up';

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

const servers = selectedTargets();

/** Handed to the setup project through the environment, because it runs in a worker: `--project` lives on the
 *  command line the run was started with, and a worker's own command line is not that. */
process.env[WARM_UP_ENV] = servers
  .filter(server => server.warmUp)
  .map(server => server.id)
  .join(',');

/** Playwright says nothing at all while it starts these, and until they are up it has nothing to show — an empty
 *  test list that looks broken rather than busy. One line, so the wait is legible.
 *
 *  Only from the process that actually starts them: workers re-load this config, and a worker's copy of the list
 *  is not what is running. */
if (process.env.TEST_WORKER_INDEX === undefined) {
  console.log(`[e2e] ${backendSummary()}`);
  console.log(`[e2e] starting ${servers.length} server(s): ${servers.map(server => server.id).join(', ')}`);
}

/** Playwright hands work out in the order the projects are listed, and `examples` holds the one long serial chain —
 *  replicas sharing a queue, waiting out a cron minute and a lease, the better part of a minute on one worker. Listed
 *  last, it began when everything else was done and the run waited for it alone; listed first, the rest runs beside
 *  it. */
const firstLongest = (all: typeof categories): typeof categories => [
  ...all.filter(category => category.name === 'examples'),
  ...all.filter(category => category.name !== 'examples')
];

export default defineConfig({
  // No top-level `testDir`: every project declares its own, and a parent that also claims the whole tree makes
  // UI mode attribute files to the wrong project.
  outputDir: `${artifacts}/test-results`,
  fullyParallel: true,
  /** Assertions auto-wait, so a high ceiling costs nothing when the page is quick and removes a whole class of
   *  cold-start flake: a Vite dev server optimises its dependency graph on the first request, which on a fresh
   *  CI runner takes longer than the 5s default — and the failure that produces looks like a broken renderer
   *  rather than a slow one. */
  expect: { timeout: isCI ? 20_000 : 10_000 },
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
  projects: [
    { name: WARM_UP, testDir: import.meta.dirname, testMatch: /warmUp\.setup\.ts$/ },
    ...firstLongest(categories).map(category => ({
      name: category.name,
      testDir: path.resolve(import.meta.dirname, 'tests', category.name),
      /** Every category waits for the warm-up, so it runs in UI mode too — the runner that most needed it, and
       *  the one `globalSetup` does not reliably cover. */
      dependencies: [WARM_UP]
    }))
  ],
  /** One process that starts every selected server at once — see `launch.ts`. Each server's stdout (a line per
   *  request) is dropped unless `E2E_SERVER_LOGS=1`; stderr, where they report failures, is kept. SIGTERM, not
   *  Playwright's default SIGKILL, so the launcher can take the servers it started down with it. */
  webServer: servers.length
    ? {
        command: 'node --import tsx launch.ts',
        cwd: import.meta.dirname,
        port: LAUNCHER_PORT,
        env: {
          ...Object.fromEntries(
            Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined)
          ),
          [LAUNCH_TARGETS_ENV]: servers.map(server => server.id).join(',')
        },
        reuseExistingServer: false,
        timeout: 200_000,
        stdout: 'pipe',
        stderr: 'pipe',
        gracefulShutdown: { signal: 'SIGTERM', timeout: 10_000 }
      }
    : undefined
});
