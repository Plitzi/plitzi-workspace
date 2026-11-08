/** What one isolate is charged of the process's CPU, read as it runs, and its end. */
export type MeteredIsolate = {
  /** The CPU charged to it so far, in ms: its own, never another's wait for a core. */
  charged: () => number;
  /** It ended: its last slice charged, and it is no longer looked at. */
  end: () => void;
};

export type CpuMeter = {
  /** Starts charging an isolate whose measured CPU `read` answers, in ms — from what it reads now. */
  meter: (read: () => number) => MeteredIsolate;
};

/**
 * The CPU the isolates' threads took, as the system counts it, in ms: the process's, every thread on a core, less its
 * main thread's — making isolates, compiling bundles, speaking to the platform is the runner's work, and counted with
 * theirs it let a running isolate be charged what V8 measured while the main thread was busy.
 */
export const isolatesCpuMs = (): number => {
  const all = process.cpuUsage();
  const main = process.threadCpuUsage();

  return (all.user + all.system - main.user - main.system) / 1000;
};

/**
 * The CPU the isolates' threads took, shared out between the isolates that ran.
 *
 * V8 measures an isolate's CPU as the time it spent running JavaScript — on a core, or ready and waiting for one — so
 * beside more threads than cores each is measured as if it had a core of its own: a 5 ms route was measured past its
 * 100 ms limit under load, and a ceiling on how much a limit may grow for it let code that spun go on, or stopped light
 * code, depending on the burst. Each look, what the isolates were measured at is scaled down, in proportion, to the
 * most they can have taken together, by whichever bound is lower: what their threads took as the system counts it, and
 * the machine's cores for the time the look spans — V8's collector and the runner's helper threads take CPU nobody is
 * measured at, and on the threads' count alone a measure inflated in those moments went through whole. The cores are
 * the machine's, not the container's quota: threads run at once on every core until the quota throttles them, and the
 * threads' count is what sees that. Code that spins alone is charged all it took; code beside others, never the cores
 * it waited for.
 */
export const createCpuMeter = (everyMs: number, cores: number, readProcess: () => number = isolatesCpuMs): CpuMeter => {
  type Entry = { read: () => number; last: number; charged: number };
  const live = new Set<Entry>();
  let lastProcess = readProcess();
  let lastAt = Date.now();
  let timer: NodeJS.Timeout | undefined;

  const look = (): void => {
    const now = readProcess();
    const spent = Math.max(0, now - lastProcess);
    lastProcess = now;
    // A look sooner than its interval — an isolate ending — is taken as a whole one: its cores' bound never shrinks
    // below what an interval holds, so a last slice is never charged less for being read early.
    const at = Date.now();
    const capacity = cores * Math.max(everyMs, at - lastAt);
    lastAt = at;
    const slices = [...live].map(entry => {
      const read = entry.read();
      const slice = Math.max(0, read - entry.last);
      entry.last = read;

      return { entry, slice };
    });
    const measured = slices.reduce((total, { slice }) => total + slice, 0);
    const share = measured > 0 ? Math.min(1, spent / measured, capacity / measured) : 1;
    slices.forEach(({ entry, slice }) => {
      entry.charged += slice * share;
    });
  };

  return {
    meter: read => {
      if (live.size === 0) {
        lastProcess = readProcess();
        lastAt = Date.now();
        timer = setInterval(look, everyMs);
        timer.unref();
      }

      const entry: Entry = { read, last: read(), charged: 0 };
      live.add(entry);

      return {
        charged: () => entry.charged,
        end: () => {
          if (!live.has(entry)) {
            return;
          }

          look();
          live.delete(entry);
          if (live.size === 0 && timer) {
            clearInterval(timer);
            timer = undefined;
          }
        }
      };
    }
  };
};
