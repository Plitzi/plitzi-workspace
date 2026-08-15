import path from 'node:path';

import { defineConfig, devices } from '@playwright/test';

import { categories } from './categories';
import { selectedTargets } from './targets';

import type { Target } from './targets';

/** One Playwright for the whole monorepo, run from the root with `yarn e2e`.
 *
 *  It is cut into categories — `sdk`, `ssr`, `rsc`, `preview`, `mcp`, `builder`, `examples`, `combined` — each of
 *  which is a Playwright project, so `yarn e2e --project=rsc` runs one slice and starts only the servers that
 *  slice declares. See `categories.ts`.
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
 *  test list that looks broken rather than busy. One line, so the wait is legible. */
console.log(`[e2e] starting ${servers.length} server(s): ${servers.map(server => server.id).join(', ')}`);

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
    trace: 'retain-on-failure',
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
