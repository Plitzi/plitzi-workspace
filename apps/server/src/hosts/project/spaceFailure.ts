import { DEV_RELOAD_PATH } from '../../core/http/stages/devReload';
import { escapeHtml } from '../../helpers/escapeHtml';

import type { Stage } from '../../core/http/types';

/**
 * The page a project's server answers with while its space does not author — while developing only.
 *
 * A `start:dev` that restarted on a save to the server's code (`src/functions/`, `src/config/`…) while the space had an
 * error of its own died on it: Node then waits for a change to the server's code, never to `src/space/`, so fixing the
 * space woke nothing and the page was gone with no word in the browser. Up instead, it answers every page with what is
 * wrong, and loads again the moment a save authors — the same reload a page showing the space waits for — or when the
 * server it reached restarts.
 */
const pageOf = (message: string): string => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>The space does not author</title>
<style>
  :root { color-scheme: light dark; }
  body { margin: 0; padding: 48px 24px; font: 15px/1.5 ui-sans-serif, system-ui, sans-serif; }
  main { max-width: 860px; margin: 0 auto; display: flex; flex-direction: column; gap: 12px; }
  pre { margin: 0; padding: 16px; border-radius: 8px; background: color-mix(in srgb, currentColor 8%, transparent);
    white-space: pre-wrap; overflow-wrap: anywhere; font: 13px/1.5 ui-monospace, monospace; }
</style>
</head>
<body>
<main>
<h1>The space does not author</h1>
<p>Fix it and save: this page loads again the moment it authors. The server is still running.</p>
<pre>${escapeHtml(message)}</pre>
</main>
<script>
  (() => {
    let boot;
    const events = new EventSource(${JSON.stringify(DEV_RELOAD_PATH)});
    events.addEventListener('reload', () => location.reload());
    events.addEventListener('hello', event => {
      const next = JSON.parse(event.data).boot;
      if (boot !== undefined && next !== boot) {
        location.reload();
      }

      boot = next;
    });
  })();
</script>
</body>
</html>
`;

/** A request for a page, as a browser asks for one — not for the server's data, its assets or its reload stream. */
const asksForPage = (method: string, accept: string | string[] | undefined): boolean =>
  method === 'GET' && [accept].flat().some(value => value?.includes('text/html'));

export const createSpaceFailure = () => {
  let failure: string | undefined;

  const stage: Stage = ctx => {
    if (failure === undefined || !asksForPage(ctx.req.method, ctx.req.headers.accept)) {
      return Promise.resolve(false);
    }

    ctx.res.setStatus(503);
    ctx.res.setHeader('Content-Type', 'text/html; charset=utf-8');
    ctx.res.setHeader('Cache-Control', 'no-store');
    ctx.res.send(pageOf(failure));

    return Promise.resolve(true);
  };

  return {
    stage,
    /** The space did not author: every page says why, until it does. */
    fail: (message: string): void => {
      failure = message;
    },
    /** It authored: the pages are the space's again. */
    clear: (): void => {
      failure = undefined;
    }
  };
};
