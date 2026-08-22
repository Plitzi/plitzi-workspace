import { createActionsModule } from './index';

import type { ActionsModule } from './index';
import type { ActionLookups, ActionsConfig } from './types';
import type { SSRServerConfig } from '@plitzi/sdk-shared';

/**
 * The one actions module for a server, whoever asks first.
 *
 * Two places need it and they are built at different moments: the page pipeline mounts the endpoint, and the RSC
 * adapter is assembled before that to resolve `render` elements. Constructing one each would give a server two
 * guard sets — and two sets each believing they hold the only run in flight is the same as having no single-flight
 * at all.
 *
 * Memoized on the config OBJECT, which is exactly the lifetime wanted: one per `createServer` call, released with
 * it, and a fresh one per server in a test file that builds several.
 */
const modules = new WeakMap<object, ActionsModule>();

export const actionsModuleFor = (config: SSRServerConfig): ActionsModule | undefined => {
  const lookups = config.action?.lookups;
  if (!lookups) {
    return undefined;
  }

  const existing = modules.get(config);
  if (existing) {
    return existing;
  }

  // The shared config types the lookups structurally (they answer `unknown`); this is the single seam where they
  // become this package's own contract.
  const module = createActionsModule({
    lookups: lookups as ActionLookups,
    tasks: config.action?.tasks as ActionsConfig['tasks'],
    limits: config.action?.limits,
    concurrency: config.action?.concurrency,
    kv: config.action?.kv,
    rateLimit: config.action?.rateLimit,
    dbDrivers: config.action?.dbDrivers as ActionsConfig['dbDrivers'],
    onRun: config.action?.onRun
  });
  modules.set(config, module);

  return module;
};
