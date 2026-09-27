import cluster from 'node:cluster';

import { startHub } from './link';
import { fleetWorkerEnv } from './role';
import { FLEET_STORES } from './stores';
import { serverLog } from '../../../helpers/serverLog';

import type { Worker } from 'node:cluster';

export type Fleet = { stop: () => Promise<void> };

const RESTART_WINDOW_MS = 60_000;
const RESTART_BASE_MS = 500;
const RESTART_MAX_MS = 30_000;

/**
 * How long the replacement for a dead worker waits, given how many have died in the last minute. As many deaths as
 * there are workers — each of them crashing once — are replaced at once; past that it doubles from half a second, up
 * to thirty.
 */
export const restartDelay = (deathsInWindow: number, count: number): number =>
  deathsInWindow <= count ? 0 : Math.min(RESTART_MAX_MS, RESTART_BASE_MS * 2 ** (deathsInWindow - count - 1));

type FleetState = { count: number; servers: number; stop: () => Promise<void> };

/** One fleet per process: a second server in the same primary shares the workers the first one started. */
let shared: FleetState | undefined;

const exitOf = (code: number | null, signal: string | null): string => (signal ? `signal ${signal}` : `code ${code}`);

/**
 * Starts `count` workers from this primary, each running the process's own entry point — so each builds and binds
 * its own server on the shared port, and the connections are spread between them.
 *
 * A worker that dies is replaced, crash or kill alike, and the replacement takes over whatever the dead one carried
 * (the jobs). Past one death per worker a minute the replacements wait, longer each time (`restartDelay`), so a
 * request that crashes whichever worker takes it cannot turn the primary into a fork loop.
 *
 * Until the fleet has served at all, a death is not retried: a worker that dies before any has listened would die
 * the same way again — a port in use, a broken build — so the fleet stops and the process exits non-zero for
 * whatever supervises it. Once it has served, a replacement that fails to start is retried like any other death:
 * the workers still serving keep serving through a passing failure (a database that is briefly down).
 *
 * `stop` asks every worker to finish with SIGTERM (what `closeOnSignals` answers) and waits for all of them. A
 * primary that dies without stopping them takes them with it: a worker exits when its channel to the primary closes.
 */
export const startFleet = (
  count: number,
  label: string,
  exit: (code: number) => void = code => process.exit(code)
): Fleet => {
  if (shared) {
    if (shared.count !== count) {
      throw new Error(
        `[${label}] this process already runs ${shared.count} workers; every server in it must ask for the same number`
      );
    }

    shared.servers += 1;
    const state = shared;

    return { stop: () => leave(state) };
  }

  const workers = new Set<Worker>();
  const restarts = new Set<NodeJS.Timeout>();
  /** When workers died, over the last minute: what decides how long the next replacement waits. */
  let deaths: number[] = [];
  let served = false;
  let stopping = false;

  const stopAll = (): Promise<void> => {
    restarts.forEach(timer => clearTimeout(timer));
    restarts.clear();

    return Promise.all(
      [...workers].map(
        worker =>
          new Promise<void>(resolve => {
            if (worker.isDead()) {
              resolve();

              return;
            }

            worker.once('exit', () => resolve());
            worker.process.kill('SIGTERM');
          })
      )
    ).then(() => undefined);
  };

  const fork = (runsJobs: boolean): void => {
    const worker = cluster.fork(fleetWorkerEnv(runsJobs));
    workers.add(worker);
    worker.once('listening', () => {
      served = true;
    });
    worker.once('exit', (code: number | null, signal: string | null) => {
      workers.delete(worker);
      if (stopping) {
        return;
      }

      if (!served) {
        serverLog.error(label, `a worker stopped before it could serve (${exitOf(code, signal)}); stopping the rest`);
        stopping = true;
        void stopAll().then(() => exit(1));

        return;
      }

      const now = Date.now();
      deaths = [...deaths.filter(at => now - at < RESTART_WINDOW_MS), now];
      const delayMs = restartDelay(deaths.length, count);
      serverLog.error(
        label,
        `worker ${worker.process.pid ?? '?'} stopped (${exitOf(code, signal)}); starting another` +
          (delayMs > 0 ? ` in ${delayMs}ms — ${deaths.length} have stopped in the last minute` : '')
      );
      // The replacement takes over what the dead one carried: its jobs, which a lapsed lease hands back to the queue.
      const timer = setTimeout(() => {
        restarts.delete(timer);
        if (!stopping) {
          fork(runsJobs);
        }
      }, delayMs);
      restarts.add(timer);
    });
  };

  // Structured clone rather than JSON: what the stores answer carries dates (a job's, the queue's clock).
  cluster.setupPrimary({ serialization: 'advanced' });
  startHub(FLEET_STORES);
  for (let index = 0; index < count; index += 1) {
    fork(index === 0);
  }

  const state: FleetState = {
    count,
    servers: 1,
    stop: async () => {
      stopping = true;
      await stopAll();
    }
  };
  shared = state;

  return { stop: () => leave(state) };
};

/** The workers stop when the last server of this process that started them closes. */
const leave = async (state: FleetState): Promise<void> => {
  state.servers -= 1;
  if (state.servers > 0) {
    return;
  }

  if (shared === state) {
    shared = undefined;
  }

  await state.stop();
};
