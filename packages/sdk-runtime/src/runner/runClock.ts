import type { FunctionLimits } from '@plitzi/sdk-shared/functions';

/** How much of an invocation's time is the runner's before the platform is told, so its wait for the answer grows. */
export const TELL_WAITED_MS = 100;

/** A sleep the code asked for: how long it waits, or that it waits past its time and is stopped at it. */
export type SleepPlan = { wakes: true; wanted: number; woke: () => void } | { wakes: false; stopInMs: number };

/**
 * An invocation's clock: what its time is, what its CPU is, and what of the clock was the runner's.
 *
 * Its own time is what it waited on that it asked for, and the CPU it was charged — what it would take on a runner of
 * its own. Never the runner's: a turn waited for, a place behind other isolates in isolated-vm's threads (one per core:
 * a spinner holds one until it ends), a core it was ready for and did not get. Counted from the clock, a route that
 * slept 200 ms on a crowded runner was stopped at its 10 s.
 *
 * Pure over `now`: it reads no isolate. Its CPU is handed in once the code begins (`begin`) — the isolate's share of the
 * process's (`createCpuMeter`) — beside what the runner spent on its behalf (`chargeHost`).
 */
export const createRunClock = ({ now = Date.now }: { now?: () => number } = {}) => {
  const startedAt = now();
  /** Its share of the process's CPU from the moment its code began; nothing is its CPU before. */
  let meteredCpu: (() => number) | undefined;
  /** What the runner spent on the run's behalf — a PBKDF2 derivation — which the isolate's clock never sees. */
  let hostCpuMs = 0;
  /** How long it waited on what it asked of the platform — calls, sleeps — counted once while it waits on several. */
  let awaitedMs = 0;
  let awaitingSince: number | undefined;
  let waits = 0;
  /**
   * A sleep counts what it asked for: the timer that wakes it is the runner's, on its main thread, and a crowded runner
   * woke a 200 ms sleep seconds late — counted, a route was stopped at its 10 s. Its lateness, of the sleeps that ended
   * and of the ones still past their time, is the runner's.
   */
  let lateMs = 0;
  const sleeping = new Set<{ from: number; wanted: number }>();
  /** What of its time was the runner's, and told the platform so far: its wait for the answer grows by it. */
  let toldWaitedMs = 0;

  const lateAt = (at: number): number =>
    [...sleeping].reduce((late, sleep) => late + Math.max(0, at - sleep.from - sleep.wanted), lateMs);

  const chargedCpu = (): number => (meteredCpu?.() ?? 0) + hostCpuMs;

  const ownMs = (): number => {
    if (!meteredCpu) {
      return 0;
    }

    const at = now();
    const awaitedNow = awaitedMs + (awaitingSince === undefined ? 0 : at - awaitingSince);

    return Math.max(0, awaitedNow - lateAt(at)) + chargedCpu();
  };

  return {
    /** Its code began: what came before — the isolate made, the bundle compiled — is the platform's time. */
    begin: (charged: () => number): void => {
      meteredCpu = charged;
    },
    chargeHost: (ms: number): void => {
      hostCpuMs += ms;
    },
    hostCpuMs: (): number => hostCpuMs,
    chargedCpu,
    ownMs,
    /** It began waiting on something it asked of the platform. */
    waitBegins: (): void => {
      if (waits === 0) {
        awaitingSince = now();
      }

      waits++;
    },
    waitEnds: (): void => {
      waits--;
      if (waits === 0 && awaitingSince !== undefined) {
        awaitedMs += now() - awaitingSince;
        awaitingSince = undefined;
      }
    },
    /** How many answers of the platform it waits for now. */
    waits: (): number => waits,
    /**
     * A sleep of `ms`: past the time it has left it ends the run there, by its time limit — never cut short to fit: cut,
     * the code woke at the limit and, the watchdog a look behind, finished as if it had slept.
     */
    sleep: (ms: number, wallMs: number): SleepPlan => {
      const left = wallMs - ownMs();
      const wanted = Math.max(0, ms);
      if (wanted >= left) {
        return { wakes: false, stopInMs: Math.max(0, left) };
      }

      const sleep = { from: now(), wanted };
      sleeping.add(sleep);

      return {
        wakes: true,
        wanted,
        woke: () => {
          sleeping.delete(sleep);
          lateMs += Math.max(0, now() - sleep.from - wanted);
        }
      };
    },
    /** The limit its time or its CPU went past, the CPU first — or nothing. */
    overLimit: ({ cpuMs, wallMs }: Pick<FunctionLimits, 'cpuMs' | 'wallMs'>): 'cpu' | 'wall' | undefined => {
      if (chargedCpu() > cpuMs) {
        return 'cpu';
      }

      return ownMs() > wallMs ? 'wall' : undefined;
    },
    /**
     * What of the clock was the runner's since it was last told, once that is a tell's worth — every moment that was
     * not its own: its isolate made, a turn, a place behind others, a core. Told the platform, whose wait for the answer
     * would otherwise run out on time the code never had.
     */
    untoldWaitedMs: (): number | undefined => {
      const runners = now() - startedAt - ownMs();
      if (runners - toldWaitedMs < TELL_WAITED_MS) {
        return undefined;
      }

      const untold = runners - toldWaitedMs;
      toldWaitedMs = runners;

      return untold;
    },
    elapsedMs: (): number => now() - startedAt
  };
};

export type RunClock = ReturnType<typeof createRunClock>;
