import { createPageEngine } from '@plitzi/sdk-actions/worker';
import { dataDirLookup } from '@plitzi/sdk-kernel/data';

import { createServer } from './createServer';

import type { Auth } from './auth/createAuth';
import type { ServerConfig } from './createServer';
import type { SSRServer } from '../types';
import type { PipelineExtensions } from './http/pageContext';
import type { EngineOptions } from '@plitzi/sdk-actions/types';

/** A page server and its actions engine in one process: the page server's configuration and the engine's. */
export type PlatformConfig = Omit<ServerConfig, 'engine'> & EngineOptions;

type ActionLookups = NonNullable<NonNullable<EngineOptions['action']>['lookups']>;

/**
 * The lookups as the engine runs them: the space's data from the files of `dataDir` when the deployment keeps none of
 * its own, and — with `auth` — every account of this server as its space's visitor, public fields alone, when it says
 * nothing of who its visitors are.
 */
const engineLookups = (lookups: ActionLookups, dataDir: string | undefined, auth: Auth | undefined): ActionLookups => ({
  ...lookups,
  ...(!lookups.getData && dataDir ? { getData: dataDirLookup(dataDir) } : {}),
  ...(!lookups.getVisitor && auth
    ? { getVisitor: (_space: number, _environment: string, who: string | number) => auth.publicAccount(who) }
    : {})
});

/**
 * Pages and actions in one process (docs/en/server-packages.md, D11): the actions engine built from `action`, `functions`, `connectors`
 * and `realtime`, and handed to the page server `createServer` makes of the rest. What `yarn start`, a project's own
 * server and most self-hosted deployments run; a deployment whose actions run on a worker of their own uses
 * `createServer` for its pages.
 */
export const createPlatform = (
  { action, functions, connectors, realtime, ...pages }: PlatformConfig,
  extensions?: PipelineExtensions
): SSRServer => {
  const lookups = action?.lookups ? engineLookups(action.lookups, pages.dataDir, pages.auth) : undefined;
  // The page server's configuration, the engine's beside it: what the engine reads of the first — the space's
  // documents, the meter, the log, `outbound` — is the same object the pages are served with.
  const engine = createPageEngine({
    ...pages,
    ...(action ? { action: { ...action, ...(lookups ? { lookups } : {}) } } : {}),
    ...(functions ? { functions } : {}),
    ...(connectors ? { connectors } : {}),
    ...(realtime === undefined ? {} : { realtime })
  });

  return createServer({ ...pages, ...(engine ? { engine } : {}) }, extensions);
};
