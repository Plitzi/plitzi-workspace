import { serverLog } from '../../helpers/serverLog';

import type { SSRContext } from '../http/types';
import type { OfflineDataRaw } from '@plitzi/sdk-shared';

/**
 * The space a page at this address renders (no deployment: the server's one space), for a file the server answers from
 * it — `/robots.txt`, `/sitemap.xml`. A space that cannot be read answers nothing, said in the server's log with the
 * file it was read for.
 */
export const servedSpace = async (ctx: SSRContext, file: string): Promise<OfflineDataRaw | undefined> => {
  const { environment = 'main', spaceId = 1, revision = 0 } = ctx.req.ctx.spaceDeployment ?? {};
  if (spaceId === null) {
    return undefined;
  }

  return ctx.config.adapters.getOfflineData(spaceId, environment, revision).catch((error: unknown) => {
    serverLog.warn('SSR', `${file} answered without the space: space ${String(spaceId)} could not be read`, error);

    return undefined;
  });
};
