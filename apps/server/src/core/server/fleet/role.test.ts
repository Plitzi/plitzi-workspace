import { afterEach, describe, expect, it, vi } from 'vitest';

/** Which process this is, as `node:cluster` would say: a primary, or a worker of somebody's cluster. */
const cluster = vi.hoisted(() => ({ isWorker: false }));

vi.mock('node:cluster', () => ({
  default: {
    get isWorker() {
      return cluster.isWorker;
    },
    get isPrimary() {
      return !cluster.isWorker;
    },
    on: vi.fn()
  }
}));

const { fleetRole, isFleetWorker, resolveWorkers, runsFleetJobs } = await import('./role');
const { fleetStore } = await import('./link');
const { KV_METHODS } = await import('../../../modules/actions/runtime/memoryKv');

const production = { NODE_ENV: 'production' };

afterEach(() => {
  cluster.isWorker = false;
  vi.unstubAllEnvs();
});

describe('resolveWorkers', () => {
  it('serves from every core in production, and from one process anywhere else', () => {
    expect(resolveWorkers(undefined, production, 4)).toEqual({ count: 4 });
    expect(resolveWorkers(undefined, { NODE_ENV: 'development' }, 4)).toEqual({ count: 1 });
    expect(resolveWorkers(undefined, {}, 4)).toEqual({ count: 1 });
    expect(resolveWorkers(undefined, { NODE_ENV: 'test' }, 4)).toEqual({ count: 1 });
  });

  it('turns on and off with a flag, and takes a count', () => {
    expect(resolveWorkers(true, {}, 4)).toEqual({ count: 4 });
    expect(resolveWorkers('auto', {}, 4)).toEqual({ count: 4 });
    expect(resolveWorkers(false, production, 4)).toEqual({ count: 1 });
    expect(resolveWorkers(2, {}, 4)).toEqual({ count: 2 });
  });

  it('never starts more processes than there are cores, and says it was asked for more', () => {
    expect(resolveWorkers(16, {}, 4)).toEqual({ count: 4, requested: 16 });
    expect(resolveWorkers(4, {}, 4)).toEqual({ count: 4 });
  });

  it('gives a quarter-core container — reported as one core — a single process', () => {
    expect(resolveWorkers(undefined, production, 1)).toEqual({ count: 1 });
    expect(resolveWorkers(true, {}, 0)).toEqual({ count: 1 });
  });

  it('reads SDK_SERVER_WORKERS when the code says nothing, and lets the code win', () => {
    expect(resolveWorkers(undefined, { SDK_SERVER_WORKERS: 'auto' }, 4)).toEqual({ count: 4 });
    expect(resolveWorkers(undefined, { SDK_SERVER_WORKERS: 'true' }, 4)).toEqual({ count: 4 });
    expect(resolveWorkers(undefined, { ...production, SDK_SERVER_WORKERS: 'false' }, 4)).toEqual({ count: 1 });
    expect(resolveWorkers(undefined, { ...production, SDK_SERVER_WORKERS: 'off' }, 4)).toEqual({ count: 1 });
    expect(resolveWorkers(undefined, { SDK_SERVER_WORKERS: ' 3 ' }, 4)).toEqual({ count: 3 });
    expect(resolveWorkers(undefined, { ...production, SDK_SERVER_WORKERS: '' }, 4)).toEqual({ count: 4 });
    expect(resolveWorkers(false, { SDK_SERVER_WORKERS: 'auto' }, 4)).toEqual({ count: 1 });
  });

  it('refuses a count that is not a whole number of processes, rather than guessing one', () => {
    for (const option of [0, -1, 1.5, Number.NaN]) {
      expect(() => resolveWorkers(option, {}, 4)).toThrow(/whole number from 1/);
    }

    expect(() => resolveWorkers(undefined, { SDK_SERVER_WORKERS: 'many' }, 4)).toThrow(/whole number from 1/);
  });
});

/** The fork: anything that leaves one process serving is `single`, and a single server is what it always was. */
describe('fleetRole', () => {
  it('is single with workers off, one asked for, or one core to run on', () => {
    expect(fleetRole(resolveWorkers(false, production, 8))).toBe('single');
    expect(fleetRole(resolveWorkers(1, production, 8))).toBe('single');
    expect(fleetRole(resolveWorkers(4, production, 1))).toBe('single');
    expect(fleetRole(resolveWorkers('auto', production, 1))).toBe('single');
    expect(fleetRole(resolveWorkers(undefined, { NODE_ENV: 'development' }, 8))).toBe('single');
  });

  it('is primary with more than one to serve, in the process that was started', () => {
    expect(fleetRole(resolveWorkers(2, production, 8))).toBe('primary');
    expect(fleetRole(resolveWorkers(undefined, production, 8))).toBe('primary');
  });

  it('is a worker when a primary of ours forked it, whatever its own config asks', () => {
    cluster.isWorker = true;
    vi.stubEnv('SDK_SERVER_FLEET', '1');

    expect(isFleetWorker()).toBe(true);
    expect(fleetRole({ count: 1 })).toBe('worker');
    expect(fleetRole({ count: 8 })).toBe('worker');
  });

  /** PM2's cluster mode, or a deployment's own `cluster.fork`: a worker, but not ours — nobody would answer it. */
  it('is single in a cluster that is not ours, and forks nothing of its own there', () => {
    cluster.isWorker = true;

    expect(isFleetWorker()).toBe(false);
    expect(fleetRole({ count: 8 })).toBe('single');
    expect(runsFleetJobs()).toBe(true);
  });
});

describe('runsFleetJobs', () => {
  it('runs them in a single server, as it always did', () => {
    expect(runsFleetJobs()).toBe(true);
  });

  it('runs them in the one worker the primary gave them to', () => {
    cluster.isWorker = true;
    vi.stubEnv('SDK_SERVER_FLEET', '1');
    vi.stubEnv('SDK_SERVER_FLEET_JOBS', '0');
    expect(runsFleetJobs()).toBe(false);

    vi.stubEnv('SDK_SERVER_FLEET_JOBS', '1');
    expect(runsFleetJobs()).toBe(true);
  });
});

describe('fleetStore outside a worker', () => {
  it('answers nothing, so the caller makes what a single server always made — and listens to no channel', () => {
    const listening = process.listenerCount('message');

    expect(fleetStore('actions.kv', KV_METHODS)).toBeUndefined();
    expect(process.listenerCount('message')).toBe(listening);
  });
});
