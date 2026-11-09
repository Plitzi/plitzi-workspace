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
 * How far back the meter's share is read: the system counts a thread's CPU in its scheduler's ticks, a few ms each, so a
 * look of 5 ms read 0 or 12 ms beside a smooth measure, and the lower bound of each look lost the lumps — eight spinners
 * that took 25 s of CPU were charged 7. Over a quarter of a second the lumps even out, and it follows a change as soon.
 */
const SHARE_WINDOW_MS = 250;

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

/** The CPU the runner's main thread took, in ms: what its cores held that no isolate had. */
export const mainThreadCpuMs = (): number => {
  const main = process.threadCpuUsage();

  return (main.user + main.system) / 1000;
};

/**
 * The CPU the isolates' threads took, shared out between the isolates that ran.
 *
 * V8 measures an isolate's CPU as the time it spent running JavaScript — on a core, or ready and waiting for one — so
 * beside more threads than cores each is measured as if it had a core of its own: a 5 ms route was measured past its
 * 100 ms limit under load, and a ceiling on how much a limit may grow for it let code that spun go on, or stopped light
 * code, depending on the burst. Each look, what the isolates were measured at is scaled down, in proportion, to the
 * most they can have taken together, by whichever bound is lower: what their threads took as the system counts it, and
 * the cores for the time the look spans less what the main thread took of them — V8's collector and the runner's helper
 * threads take CPU nobody is measured at, and on the threads' count alone a measure inflated in those moments went
 * through whole. The cores are the container's quota (`cpuLimitCores`): over the window it holds every thread to it, and
 * an isolate whose thread the main one took the core from — a thousand sockets under load — is measured by V8 as if it
 * ran: on the machine's cores, a 5 ms route was charged past its 100 ms limit. Code that spins alone is charged all it
 * took; code beside others, never the cores it waited for.
 */
export const createCpuMeter = (
  everyMs: number,
  cores: number,
  readProcess: () => number = isolatesCpuMs,
  readMain: () => number = mainThreadCpuMs
): CpuMeter => {
  type Entry = { read: () => number; last: number; charged: number };
  const live = new Set<Entry>();
  let lastProcess = readProcess();
  let lastMain = readMain();
  let lastAt = Date.now();
  let timer: NodeJS.Timeout | undefined;
  /** The last quarter second of looks: what the threads took, what the cores held, what the isolates were measured at. */
  const window: { at: number; spent: number; capacity: number; measured: number }[] = [];

  const look = (): void => {
    const now = readProcess();
    const spent = Math.max(0, now - lastProcess);
    lastProcess = now;
    // A look sooner than its interval — an isolate ending — is taken as a whole one: its cores' bound never shrinks
    // below what an interval holds, so a last slice is never charged less for being read early.
    const at = Date.now();
    const main = readMain();
    const capacity = Math.max(0, cores * Math.max(everyMs, at - lastAt) - Math.max(0, main - lastMain));
    lastMain = main;
    lastAt = at;
    const slices = [...live].map(entry => {
      const read = entry.read();
      const slice = Math.max(0, read - entry.last);
      entry.last = read;

      return { entry, slice };
    });
    const measured = slices.reduce((total, { slice }) => total + slice, 0);
    window.push({ at, spent, capacity, measured });
    while (window.length > 1 && (window[0]?.at ?? at) < at - SHARE_WINDOW_MS) {
      window.shift();
    }

    const sum = (key: 'spent' | 'capacity' | 'measured'): number =>
      window.reduce((total, look) => total + look[key], 0);
    const inWindow = sum('measured');
    const share = inWindow > 0 ? Math.min(1, sum('spent') / inWindow, sum('capacity') / inWindow) : 1;
    slices.forEach(({ entry, slice }) => {
      entry.charged += slice * share;
    });
  };

  return {
    meter: read => {
      if (live.size === 0) {
        lastProcess = readProcess();
        lastMain = readMain();
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
            window.length = 0;
          }
        }
      };
    }
  };
};
