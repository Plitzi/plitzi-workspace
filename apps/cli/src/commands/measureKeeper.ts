import { rm } from 'node:fs/promises';
import http from 'node:http';

import { launchBrowser } from '../browser';
import { measureOn } from './measure';
import { pause, readRecordFile, recordOf, writeWhole } from '../browser/keptBrowser';
import { pageAnswered } from './shot/remote';

import type { BrowserPage } from '../browser';
import type { KeptAnswer, KeptAsk } from '../browser/keptBrowser';

/**
 * The kept browser's own process (`plitzi page keep-browser`, hidden, started by `page measure`): it loads the other
 * site's pages and reads them itself, answering on this machine alone — `keptBrowser.ts` says why, and asks it.
 *
 * Everything read at once is read here, in one process: a page loaded for the first time is loaded once, the asks for it
 * meanwhile waiting on that load; a page being read is held (`readers`) and never closed under its reader — not to make
 * room, not by a `fresh` ask, which loads a new one and retires the old until its last reader is done; a stop waits for
 * what is being read, `DRAIN_MS` at most.
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

/** The pages it keeps at most: the least lately loaded of those nobody reads goes first. */
const MAX_PAGES = 10;

/** The longest one ask is worked on before it is answered as too slow: the caller then reads as before. */
const ASK_MS = 80_000;

/** The largest ask it reads: a list of elements, never more. */
const BODY_BYTES = 256 * 1024;

interface Held {
  page: BrowserPage;
  loadedAt: number;
  /** The asks reading it now: it is closed only at none. */
  readers: number;
}

const isAsk = (value: unknown): value is KeptAsk =>
  typeof value === 'object' &&
  value !== null &&
  typeof Reflect.get(value, 'url') === 'string' &&
  typeof Reflect.get(value, 'width') === 'number' &&
  typeof Reflect.get(value, 'height') === 'number' &&
  Array.isArray(Reflect.get(value, 'targets'));

const keyOf = (asked: KeptAsk): string => `${asked.url}|${String(asked.width)}|${asked.scheme ?? 'light'}`;

export const keepBrowser = async (root: string): Promise<void> => {
  const browser = await launchBrowser(root);
  if ('problem' in browser) {
    return;
  }

  const pages = new Map<string, Held>();
  /** Pages a `fresh` ask replaced, still read by an ask that took them before: closed at their last reader. */
  const retired = new Set<Held>();
  const loading = new Map<string, Promise<Held | { problem: string }>>();
  let inFlight = 0;
  let lastUse = Date.now();
  const born = Date.now();
  const record = recordOf(root);

  const closeHeld = async (held: Held): Promise<void> => {
    await held.page.close().catch(() => undefined);
  };

  // Room for one more: the least lately loaded nobody reads, until at most `MAX_PAGES` are kept.
  const makeRoom = async (): Promise<void> => {
    const free = [...pages.entries()]
      .filter(([, held]) => held.readers === 0)
      .sort((a, b) => a[1].loadedAt - b[1].loadedAt);
    for (const [key, held] of free.slice(0, Math.max(0, pages.size - MAX_PAGES))) {
      pages.delete(key);
      await closeHeld(held);
    }
  };

  // One load a page: the asks that come while it loads wait on the same promise, and read the page it ends with.
  const load = (key: string, asked: KeptAsk): Promise<Held | { problem: string }> => {
    const ongoing = loading.get(key);
    if (ongoing) {
      return ongoing;
    }

    const loaded = (async (): Promise<Held | { problem: string }> => {
      const opened = await pageAnswered(browser, asked.url, {
        width: asked.width,
        height: asked.height,
        reducedMotion: true,
        ...(asked.scheme ? { scheme: asked.scheme } : {})
      });
      if ('problem' in opened) {
        return opened;
      }

      const held: Held = { page: opened.page, loadedAt: Date.now(), readers: 0 };
      pages.set(key, held);
      await makeRoom();

      return held;
    })().finally(() => loading.delete(key));
    loading.set(key, loaded);

    return loaded;
  };

  const measure = async (asked: KeptAsk): Promise<KeptAnswer> => {
    const key = keyOf(asked);
    const kept = pages.get(key);
    // Loaded again: the old page is no one's to find, closed now or once its last reader is done.
    if (kept && asked.fresh === true && !loading.has(key)) {
      pages.delete(key);
      if (kept.readers === 0) {
        await closeHeld(kept);
      } else {
        retired.add(kept);
      }
    }

    const found = asked.fresh === true ? undefined : pages.get(key);
    const held = found ?? (await load(key, asked));
    if ('problem' in held) {
      return held;
    }

    held.readers += 1;
    try {
      const readings: KeptAnswer = { readings: [] };
      for (const target of asked.targets) {
        readings.readings.push(
          typeof target === 'string' ? await measureOn(held.page, target) : { problem: 'no element named' }
        );
      }

      return readings;
    } finally {
      held.readers -= 1;
      if (held.readers === 0 && retired.delete(held)) {
        await closeHeld(held);
      }
    }
  };

  let stopping = false;
  const stop = async (drain: boolean): Promise<void> => {
    if (stopping) {
      return;
    }

    stopping = true;
    // No ask taken from now on, its record gone — its own alone: no command asks a browser on its way out. What was
    // taken already is counted from its arrival, and waited for.
    server.close();
    if ((await readRecordFile(record))?.pid === process.pid) {
      await rm(record, { force: true });
    }

    const until = Date.now() + (drain ? DRAIN_MS : 0);
    while (inFlight > 0 && Date.now() < until) {
      await pause(200);
    }

    setTimeout(() => process.exit(0), STOP_MS).unref();
    await browser.close().catch(() => undefined);
    process.exit(0);
  };

  const server = http.createServer((request, response) => {
    const answer = (status: number, body: KeptAnswer): void => {
      response.writeHead(status, { 'content-type': 'application/json' });
      response.end(JSON.stringify(body));
    };
    if (request.method !== 'POST' || request.url !== '/measure' || stopping) {
      answer(404, { problem: 'not a kept browser’s ask' });

      return;
    }

    // In flight from its arrival, its body still on its way: a stop that came meanwhile waits for it.
    inFlight += 1;
    lastUse = Date.now();
    let counted = true;
    const done = (): void => {
      if (counted) {
        counted = false;
        inFlight -= 1;
        lastUse = Date.now();
      }
    };
    response.on('close', done);
    let text = '';
    request.setEncoding('utf8');
    request.on('data', (chunk: string) => {
      text += chunk;
      if (text.length > BODY_BYTES) {
        request.destroy();
      }
    });
    request.on('end', () => {
      let asked: unknown;
      try {
        asked = JSON.parse(text);
      } catch {
        answer(400, { problem: 'an ask that is no JSON' });

        return;
      }

      if (!isAsk(asked)) {
        answer(400, { problem: 'an ask without its page and elements' });

        return;
      }

      const slow = new Promise<KeptAnswer>(resolve =>
        setTimeout(() => resolve({ problem: 'the kept browser took too long' }), ASK_MS).unref()
      );
      void Promise.race([measure(asked), slow])
        .then(
          body => answer(200, body),
          (error: unknown) => {
            answer(200, { problem: error instanceof Error ? (error.message.split('\n')[0] ?? 'failed') : 'failed' });
            // A browser gone under it is no browser to keep: stopped, and the next command starts another.
            if (error instanceof Error && /closed|crashed|disconnected/i.test(error.message)) {
              void stop(false);
            }
          }
        )
        .finally(done);
    });
  });

  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (address === null || typeof address !== 'object') {
    await browser.close();

    return;
  }

  await writeWhole(record, JSON.stringify({ port: address.port, pid: process.pid }));
  process.on('SIGTERM', () => {
    void stop(true);
  });
  for (;;) {
    await pause(LOOK_EVERY_MS);
    // Its record gone, or another's: two started at once and the other kept, or a run's end — this one is nobody's.
    if ((await readRecordFile(record))?.pid !== process.pid) {
      await stop(true);

      continue;
    }

    if (Date.now() - born > KEPT_MAX_MS || (inFlight === 0 && Date.now() - lastUse > KEPT_IDLE_MS)) {
      await stop(true);
    }
  }
};
