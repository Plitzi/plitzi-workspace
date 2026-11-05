import { STATS_PATH } from './stage';

import type {
  InstanceHealth,
  InstanceStatus,
  PoolHealth,
  PoolInstance,
  PoolReport,
  PoolSource,
  ProcessStats
} from './types';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isStats = (value: unknown): value is ProcessStats =>
  isRecord(value) && typeof value.pool === 'string' && isRecord(value.health) && isRecord(value.load);

/** What a status means, said where nothing more particular is known. */
const MEANING: Record<InstanceStatus, string> = {
  starting: 'starting: not taking work yet',
  healthy: '',
  degraded: '',
  restarting: 'restarting: it stopped answering, and another is starting in its place',
  stopping: 'stopping: finishing what it runs, taking nothing new',
  stopped: 'stopped: it finished what it ran and went',
  failed: 'failed: it could not start, or ended on its own',
  down: 'has no address'
};

const said = (instance: PoolInstance, status: InstanceStatus, reason: string): InstanceHealth => ({
  id: instance.id,
  status,
  reasons: [instance.orchestrator?.lastExit ? `${reason} (last exit: ${instance.orchestrator.lastExit})` : reason],
  ...(instance.orchestrator ? { orchestrator: instance.orchestrator } : {})
});

/** The status its orchestrator's phase says — none while it runs, when what it answers decides. */
const phaseStatus = (instance: PoolInstance): InstanceStatus | undefined => {
  const phase = instance.orchestrator?.phase;

  return phase === undefined || phase === 'running' ? undefined : phase;
};

/** Not answering: `down` — unless its orchestrator says it is on its way in or out, which is not being down. */
const down = (instance: PoolInstance, reason: string): InstanceHealth => {
  const phase = phaseStatus(instance);

  return phase ? said(instance, phase, instance.orchestrator?.why ?? MEANING[phase]) : said(instance, 'down', reason);
};

const readInstance = async (instance: PoolInstance, timeoutMs: number): Promise<InstanceHealth> => {
  const phase = phaseStatus(instance);
  // Over, never begun, or with nowhere to ask: what its orchestrator says is all there is.
  if (phase === 'stopped' || phase === 'failed' || !instance.url) {
    const status = phase ?? 'down';

    return said(instance, status, instance.orchestrator?.why ?? MEANING[status]);
  }

  const startedAt = performance.now();
  let answer: Response;
  try {
    answer = await fetch(`${instance.url}${STATS_PATH}`, {
      headers: { authorization: `Bearer ${instance.secret}` },
      signal: AbortSignal.timeout(timeoutMs)
    });
  } catch (error) {
    return down(
      instance,
      `did not answer in ${String(timeoutMs)} ms: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  if (!answer.ok) {
    return down(
      instance,
      `answered ${String(answer.status)} at ${STATS_PATH}${answer.status === 401 ? ': its secret is not this one' : ''}`
    );
  }

  const stats: unknown = await answer.json().catch(() => undefined);
  if (!isStats(stats)) {
    return down(instance, `answered ${STATS_PATH} with something that is not a process's stats`);
  }

  const phased = phaseStatus(instance);

  return {
    id: instance.id,
    // On its way in or out, it is that, whatever its own stats got round to saying.
    status: phased ?? stats.health.status,
    latencyMs: Math.round(performance.now() - startedAt),
    reasons: stats.health.reasons,
    stats,
    ...(instance.orchestrator ? { orchestrator: instance.orchestrator } : {})
  };
};

const countsOf = (read: InstanceHealth[]): Record<InstanceStatus, number> => {
  const counts: Record<InstanceStatus, number> = {
    starting: 0,
    healthy: 0,
    degraded: 0,
    restarting: 0,
    stopping: 0,
    stopped: 0,
    failed: 0,
    down: 0
  };
  read.forEach(each => {
    counts[each.status] += 1;
  });

  return counts;
};

/**
 * Every pool's health at once: each instance's `/_stats` read beside the others, and one that does not answer is
 * `down`, with what its orchestrator knows of why. Without a source it says so.
 */
export const readPools = async (
  source: PoolSource | undefined,
  { timeoutMs = 2000 }: { timeoutMs?: number } = {}
): Promise<PoolHealth> => {
  const at = new Date().toISOString();
  if (!source) {
    return { at, unconfigured: 'No pool source is configured: nothing says which processes this deployment runs' };
  }

  const pools = await source.pools();
  const reports = await Promise.all(
    pools.map(async ({ pool, instances }): Promise<PoolReport> => {
      const read = await Promise.all(instances.map(instance => readInstance(instance, timeoutMs)));
      const versions = [...new Set(read.flatMap(each => (each.stats?.version ? [each.stats.version] : [])))].sort();

      return {
        pool,
        instances: read,
        counts: countsOf(read),
        versions
      };
    })
  );

  return { at, pools: reports };
};

/**
 * The pools of a deployment whose processes are known where it starts them — a gateway's roles, a local runtime
 * driver's children: each instance named with its pool, where it listens and its secret.
 */
export const createLocalPoolSource = (instances: readonly (PoolInstance & { pool: string })[]): PoolSource => ({
  pools: () => {
    const byPool = new Map<string, PoolInstance[]>();
    instances.forEach(({ pool, ...instance }) => byPool.set(pool, [...(byPool.get(pool) ?? []), instance]));

    return Promise.resolve([...byPool].map(([pool, members]) => ({ pool, instances: members })));
  }
});
