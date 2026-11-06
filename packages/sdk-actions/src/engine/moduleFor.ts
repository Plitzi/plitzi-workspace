import { privateOriginsOf } from '@plitzi/sdk-kernel/outbound';
import { statsRecorderFor } from '@plitzi/sdk-kernel/stats';

import { actionLookupsOf, dbDriversOf, functionsConfigOf } from './configSeam';
import { DEFAULT_JOB_WORKERS } from './jobs/jobs';
import { createActionsModule } from './module';
import { realtimeModuleFor } from '../realtime';
import { recordedRun } from './runtime/runStats';

import type { ActionsModule } from './module';
import type { EngineConfig } from '../types';

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

export const actionsModuleFor = (config: EngineConfig): ActionsModule | undefined => {
  const lookups = config.action?.lookups;
  if (!lookups) {
    return undefined;
  }

  const existing = modules.get(config);
  if (existing) {
    return existing;
  }

  const stats = config.stats ? statsRecorderFor(config.stats, config.health?.version) : undefined;
  const module = createActionsModule({
    lookups: actionLookupsOf(lookups),
    flags: config.flags,
    functions: functionsConfigOf(config.functions),
    limits: config.action?.limits,
    limitsFor: config.action?.limitsFor,
    concurrency: config.action?.concurrency,
    kv: config.action?.kv,
    jobs: config.action?.jobs,
    rateLimit: config.action?.rateLimit,
    idempotency: config.action?.idempotency,
    signingSecret: config.action?.signingSecret,
    dbDrivers: dbDriversOf(config.action?.dbDrivers),
    email: config.action?.email,
    outbound: { privateOrigins: privateOriginsOf(config.outbound?.privateOrigins) },
    onRun: stats ? recordedRun(stats, config.action?.onRun) : config.action?.onRun,
    realtime: realtimeModuleFor(config)
  });
  if (stats) {
    const sizes = module.guards.slots();
    stats.slot('calls', sizes.calls.of, () => module.guards.slots().calls.used);
    stats.slot('renders', sizes.renders.of, () => module.guards.slots().renders.used);
    // The jobs it runs at once beside them: what an autoscaler adds to the queue's due ones to size its pool.
    const jobs = module.jobs;
    const jobWorkers = config.action?.jobs === false ? 0 : (config.action?.jobs?.workers ?? DEFAULT_JOB_WORKERS);
    if (jobs && jobWorkers > 0) {
      stats.slot('jobs', jobWorkers, () => jobs.worker.inFlight(), { queues: true });
    }
  }

  modules.set(config, module);

  return module;
};
