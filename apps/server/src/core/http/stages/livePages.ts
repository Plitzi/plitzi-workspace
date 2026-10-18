import { randomUUID } from 'node:crypto';

import { PREVIEW_TOKEN_PARAM } from '../../previewToken';
import { openEventStream } from '../sse';

import type { EventStream } from '../sse';
import type { Stage } from '../types';
import type { OfflineDataRaw, PluginEntry } from '@plitzi/sdk-shared';

/** Where an open page listens for what the server has to tell it: its space changed, a plugin was built again. */
export const LIVE_PAGES_PATH = '/__plitzi/live';

/**
 * The pages open on this server, told what changed under them without the server restarting.
 *
 * - **The space** (`updatePages`): every page showing it swaps it where it stands — its state, scroll and focus kept —
 *   or loads again when it cannot (`replaceSpace` of the SDK's `render`). The edit loop of a project that authors its
 *   space in code (`serveProject` re-authors and hands the new documents over), and a page an agent keeps rewriting
 *   (`createAuthoringHost`'s `update`). A page listens for the space it was drawn with: the host's own, or one draft
 *   (`?__pt=<id>`, named by the page in its listening address — never by the cookie, which one browser shares between
 *   every draft it has open).
 * - **Everything** (`reloadPages`): every page loads again.
 * - **A plugin built again** (`plugin`): every page imports the new bundle and swaps it where it is drawn.
 *
 * Only with `livePages` on: every open page keeps a connection for it, which a server whose space never changes under
 * it — a published one, or a platform's — would pay for and get nothing from. The template listens only then too.
 *
 * Each connection is greeted with this process's `boot`, and a page that reconnects to a different one loads again: the
 * server restarted — `start:dev` saw its code change (`main.ts`, its options, its actions, `src/functions/`) — and
 * what is on screen was built by the one before. Without it the page kept the old plugin until somebody reloaded it,
 * which reads as "my change did nothing".
 */
export const createLivePages = () => {
  /** Each open page's stream, by the space it shows: `''` the host's own, otherwise the draft's token. */
  const listening = new Map<EventStream, string>();
  const boot = randomUUID();

  const stage: Stage = ctx => {
    if (!ctx.config.livePages || ctx.req.path !== LIVE_PAGES_PATH) {
      return Promise.resolve(false);
    }

    const stream = openEventStream(ctx.rawRes, { onAbort: () => listening.delete(stream), retryMs: 1000 });
    listening.set(stream, ctx.req.query[PREVIEW_TOKEN_PARAM] ?? '');
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
    reload: (): void => listening.forEach((_, stream) => stream.send('reload', {})),
    /**
     * The pages showing the host's own space — or, with `draft`, that draft — swap it for `documents` where they stand;
     * one that cannot loads again. How many pages were told.
     */
    update: (documents: OfflineDataRaw, { draft = '' }: { draft?: string } = {}): number => {
      let told = 0;
      listening.forEach((scope, stream) => {
        if (scope === draft) {
          stream.send('space', { documents });
          told += 1;
        }
      });

      return told;
    },
    /**
     * A plugin built again: every open page imports its new bundle and swaps it where it is drawn (`keyName` is what
     * the page registered it as), and points its stylesheet at the new one — without loading again.
     */
    plugin: ({ keyName, js, css }: PluginEntry): void =>
      listening.forEach((_, stream) => stream.send('plugin', { key: keyName, js, css })),
    /** The streams ended — the server is going away, and each page reconnects to whichever comes up next. */
    close: (): void => {
      listening.forEach((_, stream) => stream.close());
      listening.clear();
    }
  };
};
