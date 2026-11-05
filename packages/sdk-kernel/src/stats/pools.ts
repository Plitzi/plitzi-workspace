import { STATS_PATH } from './stage';

import type { InstanceHealth, PoolHealth, PoolInstance, PoolReport, PoolSource, ProcessStats } from './types';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isStats = (value: unknown): value is ProcessStats =>
  isRecord(value) && typeof value.pool === 'string' && isRecord(value.health) && isRecord(value.load);

const down = (instance: PoolInstance, reason: string): InstanceHealth => ({
  id: instance.id,
  status: 'down',
  reasons: [instance.orchestrator?.lastExit ? `${reason} (last exit: ${instance.orchestrator.lastExit})` : reason],
  ...(instance.orchestrator ? { orchestrator: instance.orchestrator } : {})
});

const readInstance = async (instance: PoolInstance, timeoutMs: number): Promise<InstanceHealth> => {
  if (instance.unreachable) {
    return down(instance, instance.unreachable);
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

  return {
    id: instance.id,
    status: stats.health.status,
    latencyMs: Math.round(performance.now() - startedAt),
    reasons: stats.health.reasons,
    stats,
    ...(instance.orchestrator ? { orchestrator: instance.orchestrator } : {})
  };
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
        counts: {
          healthy: read.filter(each => each.status === 'healthy').length,
          degraded: read.filter(each => each.status === 'degraded').length,
          down: read.filter(each => each.status === 'down').length
        },
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
