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
 * Only with `devReload` on: every open page keeps a connection for it, which a server that never calls `reloadPages`
 * — a published one, or a platform's — would pay for and get nothing from. The template listens only then too.
 */
export const createDevReload = () => {
  const listening = new Set<EventStream>();

  const stage: Stage = ctx => {
    if (!ctx.config.devReload || ctx.req.path !== DEV_RELOAD_PATH) {
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
