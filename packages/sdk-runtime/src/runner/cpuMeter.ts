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
 * code, depending on the burst. What their threads took, as the system counts it, is the truth: each look, what the
 * isolates were measured at is scaled to it when they add up to more, and charged as measured when they do not. Code
 * that spins is charged the CPU it took; code beside it, never the cores it waited for.
 */
export const createCpuMeter = (everyMs: number, readProcess: () => number = isolatesCpuMs): CpuMeter => {
  type Entry = { read: () => number; last: number; charged: number };
  const live = new Set<Entry>();
  let lastProcess = readProcess();
  let timer: NodeJS.Timeout | undefined;

  const look = (): void => {
    const now = readProcess();
    const spent = Math.max(0, now - lastProcess);
    lastProcess = now;
    const slices = [...live].map(entry => {
      const read = entry.read();
      const slice = Math.max(0, read - entry.last);
      entry.last = read;

      return { entry, slice };
    });
    const measured = slices.reduce((total, { slice }) => total + slice, 0);
    const share = measured > spent ? spent / measured : 1;
    slices.forEach(({ entry, slice }) => {
      entry.charged += slice * share;
    });
  };

  return {
    meter: read => {
      if (live.size === 0) {
        lastProcess = readProcess();
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
