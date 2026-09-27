import { describeCatalog } from '../taskCatalog';

import type { ActionsModule } from '../index';
import type { SpaceRevision, SSRResponseHelpers } from '@plitzi/sdk-shared';

export type ActionCatalogDeps = {
  res: SSRResponseHelpers;
  module: ActionsModule;
  /** The space asking, as of the revision it is serving: its own functions are part of what it can run. */
  spaceId?: number;
  at?: SpaceRevision;
};

/**
 * Serves the tasks this server can run.
 *
 * The editor asks the SERVER what steps exist instead of holding a hardcoded list, and that is the whole reason a
 * self-hoster's own task appears in their builder with no fork: registering it is publishing it. It also means a
 * deployment with no database driver never offers `db.query` — the catalog is what that deployment actually has,
 * not what the SDK could imagine.
 *
 * Session-gated by the pipeline: the catalog names a deployment's server-side capabilities, which is not something
 * to hand an anonymous visitor.
 */
export const handleActionCatalog = async ({ res, module, spaceId, at }: ActionCatalogDeps): Promise<void> => {
  const registry = spaceId === undefined ? module.registry : await module.registryFor(spaceId, at);
  res.setStatus(200);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  // Registered at boot and constant for the life of the process, but a stale catalog in a builder tab is an editor
  // offering steps the server no longer has. It is a small payload; correctness wins.
  res.setHeader('Cache-Control', 'no-store');
  res.send(JSON.stringify({ tasks: describeCatalog(registry) }));
};
