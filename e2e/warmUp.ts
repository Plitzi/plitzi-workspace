import { chromium } from '@playwright/test';

import { targets } from './targets';

import type { Target } from './targets';
import type { Browser } from '@playwright/test';

/** Pays the cost of a dev server's first page load, once, before any spec runs.
 *
 *  Vite decides what to pre-bundle by crawling the module graph of the first page that asks for it. When that
 *  crawl turns up a dependency it had not bundled, it rebuilds and answers every request already in flight with
 *  `504 (Outdated Optimize Dep)`, then reloads the page. The app recovers; the run does not. Those are real
 *  console errors, and the reload lands in the middle of whatever the spec was asserting.
 *
 *  None of that is the product. On a warm cache the builder category passes in six seconds; on a fresh checkout —
 *  or any CI runner, where the cache is always fresh — the same three specs failed, then passed when re-run. A
 *  test that only fails the first time is the worst shape a failure can have: it teaches you to press play again
 *  instead of to read.
 *
 *  This runs as a **setup project** the categories depend on, not as `globalSetup`. Both work from the command
 *  line; only the setup project also runs in UI mode, which is exactly where "red, then green on the re-run" is
 *  most confusing and least likely to be investigated. */

/** Which servers to warm, handed over by the config rather than recomputed here: the selection is read off the
 *  command line, and a worker process does not have the command line the run was started with. */
export const WARM_UP_ENV = 'PLITZI_WARM_UP';

/** One load, reporting whether the optimizer interrupted it. */
const visit = async (browser: Browser, target: Target): Promise<boolean> => {
  const page = await browser.newPage({ ignoreHTTPSErrors: true });

  let reoptimized = false;
  page.on('response', response => {
    if (response.status() === 504) {
      reoptimized = true;
    }
  });

  try {
    await page.goto(target.origin, { waitUntil: 'networkidle', timeout: 120_000 });
    // The reload Vite triggers arrives after the load that provoked it, so settling is part of the visit.
    await page.waitForTimeout(2_000);
  } catch {
    // Best effort. A target that cannot finish loading — no backend to answer it, nothing at that origin yet —
    // still crawled its module graph on the way, which is the whole of what this is for.
  }

  await page.close();

  return !reoptimized;
};

export const warmUpDevServers = async (): Promise<void> => {
  const ids = (process.env[WARM_UP_ENV] ?? '').split(',').filter(Boolean);
  const cold = targets.filter(target => ids.includes(target.id));

  if (!cold.length) {
    return;
  }

  const browser = await chromium.launch();

  await Promise.all(
    cold.map(async target => {
      // Re-optimizing can uncover another dependency, so this converges rather than assuming one pass. Three is
      // the ceiling: a server still rebuilding after that is not doing cold-start work any more.
      for (let attempt = 0; attempt < 3; attempt += 1) {
        if (await visit(browser, target)) {
          return;
        }
      }
    })
  );

  await browser.close();
};
