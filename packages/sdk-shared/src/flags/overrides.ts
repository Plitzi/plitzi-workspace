import { forcedFlagsFromCookies } from './flagsCookie';

import type { FlagOverrides } from './resolveFlags';
import type { Environment } from '../types';

/** What a request says of the flags a tester forced: its cookies, and the host it was addressed to (`requestAuthority`). */
export type FlagRequest = { cookie: string | undefined; authority: string };

/**
 * The feature flags a deployment decides, by name — the `server` layer: above what each space declares, below the SDK
 * embedding a page and a tester with the dev tools. A function when one server renders several spaces that do not share
 * their flags: it is asked per render.
 */
export type ServerFlags =
  Record<string, boolean> | ((space: { spaceId: number; environment: Environment }) => Record<string, boolean>);

/** The deployment's own layer for one space: `config.flags`, asked per space when it is a function. */
export const serverFlagsFor = (
  config: { flags?: ServerFlags },
  space: { spaceId: number; environment: Environment }
): Record<string, boolean> | undefined => (typeof config.flags === 'function' ? config.flags(space) : config.flags);

/**
 * The flags a tester forced from the dev tools, for a request allowed to debug — undefined for everybody else, and for
 * a tester who forced nothing. Authorization is asked only when there is a cookie to honour, because answering it can
 * mean reading the space.
 */
export const forcedFlagsFor = async (
  req: FlagRequest,
  authorized: boolean | (() => Promise<boolean>)
): Promise<Record<string, boolean> | undefined> => {
  const forced = forcedFlagsFromCookies(req.cookie, req.authority);
  if (Object.keys(forced).length === 0) {
    return undefined;
  }

  const allowed = typeof authorized === 'boolean' ? authorized : await authorized();

  return allowed ? forced : undefined;
};

/** Both layers this server answers for, for one request. */
export const requestFlagOverrides = async (
  config: { flags?: ServerFlags },
  req: FlagRequest,
  space: { spaceId: number; environment: Environment },
  authorized: boolean | (() => Promise<boolean>)
): Promise<FlagOverrides> => {
  const server = serverFlagsFor(config, space);
  const qa = await forcedFlagsFor(req, authorized);

  return { ...(server ? { server } : {}), ...(qa ? { qa } : {}) };
};
