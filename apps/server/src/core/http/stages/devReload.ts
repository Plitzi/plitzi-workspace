import { randomUUID } from 'node:crypto';

import { openEventStream } from '../sse';

import type { EventStream } from '../sse';
import type { Stage } from '../types';
import type { PluginEntry } from '@plitzi/sdk-shared';

/** Where an open page listens for "the space changed: load again", in development. */
export const DEV_RELOAD_PATH = '/__plitzi/reload';

/**
 * The page reloading itself when the space it shows changed — the edit loop of a project that authors its space in
 * code, without restarting the server: `main.ts` re-authors in a process of its own and calls `reloadPages()`, and
 * every page open on this server loads again.
 *
 * Only with `devReload` on: every open page keeps a connection for it, which a server that never calls `reloadPages`
 * — a published one, or a platform's — would pay for and get nothing from. The template listens only then too.
 *
 * Each connection is greeted with this process's `boot`, and a page that reconnects to a different one loads again: the
 * server restarted — `start:dev` saw its code change (`main.ts`, its options, its actions, a plugin, `functions/`) — and
 * what is on screen was built by the one before. Without it the page kept the old plugin until somebody reloaded it,
 * which reads as "my change did nothing".
 */
export const createDevReload = () => {
  const listening = new Set<EventStream>();
  const boot = randomUUID();

  const stage: Stage = ctx => {
    if (!ctx.config.devReload || ctx.req.path !== DEV_RELOAD_PATH) {
      return Promise.resolve(false);
    }

    const stream = openEventStream(ctx.rawRes, { onAbort: () => listening.delete(stream), retryMs: 1000 });
    listening.add(stream);
    stream.send('hello', { boot });
    ctx.raw.once('close', () => {
      listening.delete(stream);
      stream.close();
    });

    return Promise.resolve(true);
  };

  return {
    stage,
    /** Every page open on this server loads again. */
    reload: (): void => listening.forEach(stream => stream.send('reload', {})),
    /**
     * A plugin built again: every open page imports its new bundle and swaps it where it is drawn (`keyName` is what
     * the page registered it as), and points its stylesheet at the new one — without loading again.
     */
    plugin: ({ keyName, js, css }: PluginEntry): void =>
      listening.forEach(stream => stream.send('plugin', { key: keyName, js, css })),
    /** The streams ended — the server is going away, and each page reconnects to whichever comes up next. */
    close: (): void => {
      listening.forEach(stream => stream.close());
      listening.clear();
    }
  };
};
