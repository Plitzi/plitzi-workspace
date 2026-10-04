import { openEventStream } from '../sse';

import type { EventStream } from '../sse';
import type { Stage } from '../types';

/** Where an open page listens for "the space changed: load again", in development. */
export const DEV_RELOAD_PATH = '/__plitzi/reload';

/**
 * The page reloading itself when the space it shows changed — the edit loop of a project that authors its space in
 * code, without restarting the server: `main.ts` re-authors in a process of its own and calls `reloadPages()`, and
 * every page open on this server loads again.
 *
 * Only in `devMode`: a published page has no reason to keep a connection open for this, and the template only
 * listens when the server says it may (`devReload` in its params).
 */
export const createDevReload = () => {
  const listening = new Set<EventStream>();

  const stage: Stage = ctx => {
    if (!ctx.config.devMode || ctx.req.path !== DEV_RELOAD_PATH) {
      return Promise.resolve(false);
    }

    const stream = openEventStream(ctx.rawRes, { onAbort: () => listening.delete(stream), retryMs: 1000 });
    listening.add(stream);
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
    /** The streams ended — the server is going away, and each page reconnects to whichever comes up next. */
    close: (): void => {
      listening.forEach(stream => stream.close());
      listening.clear();
    }
  };
};
