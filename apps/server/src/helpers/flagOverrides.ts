import { forcedFlagsFromCookies } from '@plitzi/sdk-shared/flags';

import { requestAuthority } from '../core/requestParser';

import type { Environment, FlagOverrides, SSRServerConfig } from '@plitzi/sdk-shared';

/** The deployment's own layer for one space: `config.flags`, asked per space when it is a function. */
export const serverFlagsFor = (
  config: Pick<SSRServerConfig, 'flags'>,
  space: { spaceId: number; environment: Environment }
): Record<string, boolean> | undefined => (typeof config.flags === 'function' ? config.flags(space) : config.flags);

/**
 * The flags a tester forced from the dev tools, for a request allowed to debug — undefined for everybody else, and for
 * a tester who forced nothing. Authorization is asked only when there is a cookie to honour, because answering it can
 * mean reading the space.
 */
export const forcedFlagsFor = async (
  req: { headers: { cookie?: string; host?: string; ':authority'?: string } },
  authorized: boolean | (() => Promise<boolean>)
): Promise<Record<string, boolean> | undefined> => {
  const forced = forcedFlagsFromCookies(req.headers.cookie, requestAuthority(req));
  if (Object.keys(forced).length === 0) {
    return undefined;
  }

  const allowed = typeof authorized === 'boolean' ? authorized : await authorized();

  return allowed ? forced : undefined;
};

/** Both layers this server answers for, for one request. */
export const requestFlagOverrides = async (
  config: Pick<SSRServerConfig, 'flags'>,
  req: { headers: { cookie?: string; host?: string; ':authority'?: string } },
  space: { spaceId: number; environment: Environment },
  authorized: boolean | (() => Promise<boolean>)
): Promise<FlagOverrides> => {
  const server = serverFlagsFor(config, space);
  const qa = await forcedFlagsFor(req, authorized);

  return { ...(server ? { server } : {}), ...(qa ? { qa } : {}) };
};
