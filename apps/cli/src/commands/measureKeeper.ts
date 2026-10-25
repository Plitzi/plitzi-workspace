import { rm } from 'node:fs/promises';

import { launchBrowser } from '../browser';
import { keeperRoutes } from './keeperRoutes';
import { keeperServer } from './keeperServer';
import { keptPages } from './keptPages';
import { measureOn } from './measureOn';
import { putIn, settle } from './measureState';
import { outlineOnPage } from './outline';
import { readState } from './play';
import { cliBuild, pause, readRecordFile, recordOf, writeWhole } from '../browser/keptBrowser';
import { pageAnswered } from './shot/remote';
import { actStep } from './shot/steps';

import type { BrowserPage } from '../browser';
import type { KeptView } from '../browser/keptBrowser';

/**
 * The kept browser's own process (`plitzi page keep-browser`, hidden, started by `page measure`): the other site's
 * pages held and read here (`keptPages.ts`), its stateful reads and plays on pages of their own (`keeperRoutes.ts`), all
 * in one context whose cache holds the site warm — asked over HTTP on this machine alone (`keeperServer.ts`);
 * `keptBrowser.ts` says why, and asks it. Its life: 5 minutes unused, an hour whatever happens, its record gone or another's, a run's end
 * (SIGTERM) — each stop first taking no ask, then waiting for those taken, then closing its browser, and leaving
 * regardless once a close hangs.
 */

/** How long it waits with nothing asked of it before it stops: an agent between two measures, never a run left behind. */
export const KEPT_IDLE_MS = 5 * 60_000;

/** The longest it lives, used or not: whatever failed to stop it otherwise, it is gone within the hour. */
export const KEPT_MAX_MS = 60 * 60_000;

/** How long a stop waits for what is being read before it closes the browser anyway. */
const DRAIN_MS = 2 * 60_000;

/** How long a stop is given before the process leaves regardless: a browser that hangs on closing is not waited for. */
const STOP_MS = 5000;

/** How often it looks whether it is still used, and still the one its record names. */
const LOOK_EVERY_MS = 20_000;

/** The pages it keeps at most. */
const MAX_PAGES = 10;

/** The longest one ask is worked on before it is answered as too slow: the caller then reads as before. */
const ASK_MS = 80_000;

/** The largest ask it reads: a list of elements, never more. */
const BODY_BYTES = 256 * 1024;

export const keepBrowser = async (root: string): Promise<void> => {
  const browser = await launchBrowser(root);
  if ('problem' in browser) {
    return;
  }

  const record = recordOf(root);
  const born = Date.now();
  // One context for every page: what the other site sends one page, the next takes from its cache.
  const context = await browser.newContext();
  const open = (view: KeptView) =>
    pageAnswered(
      browser,
      view.url,
      {
        width: view.width,
        height: view.height,
        reducedMotion: view.reducedMotion ?? true,
        ...(view.scheme ? { scheme: view.scheme } : {})
      },
      context
    );
  const pages = keptPages({ open, read: measureOn, close: page => page.close(), max: MAX_PAGES });
  // A page for one ask alone: one kept already, taken and replaced — loaded, the site's widgets settled — in the media
  // the ask wants (a play's motion played, a measure's held still).
  const claimed = async (view: KeptView) => {
    const taken = await pages.claim(view);
    if (!('problem' in taken)) {
      await taken.page.emulateMedia({
        colorScheme: view.scheme ?? 'light',
        reducedMotion: view.reducedMotion === false ? 'no-preference' : 'reduce'
      });
    }

    return taken;
  };
  const served = keeperRoutes<BrowserPage>({
    measure: pages.measure,
    open: claimed,
    measureOn,
    putIn: (page, state) =>
      putIn(
        page,
        {
          kind: state.kind,
          pairs: state.targets.map(each => ({ here: each, there: each })),
          ...(state.then
            ? { then: { kind: state.then.kind, pair: { here: state.then.target, there: state.then.target } } }
            : {})
        },
        'here'
      ),
    outline: async (page, asked) => {
      const read = await outlineOnPage(page, asked);

      return 'problem' in read ? { problem: read.problem } : { outline: read.outline };
    },
    act: async (page, step, index) => {
      const problem = await actStep(page, step, index);
      if (!problem) {
        await settle(page);
      }

      return problem;
    },
    readState,
    close: page => page.close()
  });
  let stopping = false;
  const stop = async (drain: boolean): Promise<void> => {
    if (stopping) {
      return;
    }

    stopping = true;
    setTimeout(() => process.exit(0), (drain ? DRAIN_MS : 0) + STOP_MS).unref();
    // Its record goes first, its own alone: no command asks a browser on its way out.
    if ((await readRecordFile(record))?.pid === process.pid) {
      await rm(record, { force: true });
    }

    await server.drain(drain ? DRAIN_MS : 0);
    await served.closeAll();
    await browser.close().catch(() => undefined);
    process.exit(0);
  };
  const server = keeperServer({
    routes: served.routes,
    askMs: ASK_MS,
    bodyBytes: BODY_BYTES,
    // A browser gone under an ask is no browser to keep: stopped, and the next command starts another.
    onError: error => {
      if (error instanceof Error && /closed|crashed|disconnected/i.test(error.message)) {
        void stop(false);
      }
    }
  });
  const port = await server.listen().catch(() => undefined);
  if (port === undefined) {
    await browser.close();

    return;
  }

  await writeWhole(record, JSON.stringify({ port, pid: process.pid, build: await cliBuild() }));
  process.on('SIGTERM', () => {
    void stop(true);
  });
  for (;;) {
    await pause(LOOK_EVERY_MS);
    await served.sweep();
    // Its record gone, or another's: two started at once and the other kept, or a run's end — this one is nobody's.
    if ((await readRecordFile(record))?.pid !== process.pid) {
      await stop(true);

      continue;
    }

    if (Date.now() - born > KEPT_MAX_MS || (server.inFlight() === 0 && Date.now() - server.lastUse() > KEPT_IDLE_MS)) {
      await stop(true);
    }
  }
};
