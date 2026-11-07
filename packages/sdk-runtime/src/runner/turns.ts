/** How long an isolate holds a turn before one waiting is let in beside it, in ms of holding. */
export const TURN_SLICE_MS = 20;

/**
 * Turns at running JavaScript, handed out in the order they were asked for: as many running at once as the runner has
 * cores — what keeps them from fighting for its CPU. A turn held past a slice no longer counts against them while others
 * wait: a long run shares the CPU with the next, as a scheduler would, rather than holding every other isolate up. Long
 * runs all at once are the CPU truly short, and the service's own CPU gate turns new invocations away to another runner.
 */
export const createTurns = (size: number) => {
  const held = new Map<number, number>();
  const queue: ((id: number) => void)[] = [];
  let next = 0;
  let timer: NodeJS.Timeout | undefined;

  /** The turns held within their slice: what the next one waits for. */
  const fresh = (now: number): number => [...held.values()].filter(since => now - since < TURN_SLICE_MS).length;

  const grant = (): number => {
    const id = next++;
    held.set(id, Date.now());

    return id;
  };

  const serve = (): void => {
    const now = Date.now();
    while (queue.length > 0 && fresh(now) < size) {
      queue.shift()?.(grant());
    }

    if (queue.length === 0 && timer) {
      clearInterval(timer);
      timer = undefined;
    } else if (queue.length > 0 && !timer) {
      // What waits is looked at again as slices run out, not only when a turn is given back.
      timer = setInterval(serve, TURN_SLICE_MS / 4);
    }
  };

  return {
    /** How many isolates run at once against the turns there are: past 1, they share the CPU — each measured slower. */
    load: (): number => held.size / size,
    /** How many wait for a turn: what says the runner's CPU is short now, before any reading of it. */
    waiting: (): number => queue.length,
    take: async (): Promise<number> => {
      if (queue.length === 0 && held.size < size) {
        return grant();
      }

      const turn = new Promise<number>(resolve => queue.push(resolve));
      serve();

      return turn;
    },
    give: (id: number): void => {
      held.delete(id);
      serve();
    }
  };
};
