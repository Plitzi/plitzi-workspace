import { serverLog } from '../../helpers/serverLog';

import type { SSRContext, Stage } from '../http/types';

/** What a space that says nothing answers: everything may be crawled. */
export const DEFAULT_ROBOTS_TXT = 'User-agent: *\nAllow: /\n';

/**
 * `/robots.txt`, the space's own (`settings.robotsTxt`), or one that lets crawlers read everything: never the space's
 * page for an address it has none for — a crawler reads a 404 page as "no rules", and an HTML page as rules it cannot
 * parse. Read from the space a page at this address renders (no deployment: the server's one space); a space that
 * cannot be read answers the default, said in the server's log.
 */
export const robotsTxtStage: Stage<SSRContext> = async ctx => {
  const { config, req } = ctx;
  if (req.method !== 'GET' || req.path !== '/robots.txt') {
    return false;
  }

  ctx.operation = 'robots';
  const { environment = 'main', spaceId = 1, revision = 0 } = req.ctx.spaceDeployment ?? {};
  const data =
    spaceId === null
      ? undefined
      : await config.adapters.getOfflineData(spaceId, environment, revision).catch((error: unknown) => {
          serverLog.warn('SSR', `/robots.txt answered the default: space ${String(spaceId)} could not be read`, error);

          return undefined;
        });
  const own = data?.schema.settings.robotsTxt;
  ctx.res.setStatus(200);
  ctx.res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  ctx.res.send(own && own.trim() !== '' ? (own.endsWith('\n') ? own : `${own}\n`) : DEFAULT_ROBOTS_TXT);

  return true;
};
