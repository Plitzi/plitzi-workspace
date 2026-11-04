import { serverLog } from '../../helpers/serverLog';

import type { SSRRenderLimitConfig, SSRSpaceDeployment } from '@plitzi/sdk-shared';

/**
 * How many pages of one space this process renders at once (`renderLimit`): the turns of each space, and the requests
 * waiting for one. A page served kept takes no turn — only a render does — so what a limit holds back is what costs:
 * pages nobody can be handed (a visitor's own, a draft drawn with its providers' answers), and a burst of addresses
 * no kept page answers (every `?x=<random>` a new key). One space's burst then waits behind its own turns instead of
 * taking every render this process has from the other spaces it serves.
 */
export type RenderTurns = {
  /**
   * A turn for a page of `spaceId` — waited for behind the space's others, up to `waitMs` — and how to give it back;
   * `undefined` when none came in time.
   */
  take: (spaceId: number, limit: number, waitMs: number) => Promise<(() => void) | undefined>;
  /** A turn now or none: what a render nobody waits for takes (a stale page drawn again behind the one served). */
  tryTake: (spaceId: number, limit: number) => (() => void) | undefined;
  /** The renders of `spaceId` this process is drawing now. */
  running: (spaceId: number) => number;
  /** Says a page of `spaceId` was answered 503 for want of a turn (`busyLog`). */
  refused: (spaceId: number, limit: number) => void;
};

type SpaceTurns = { running: number; waiting: ((release: () => void) => void)[] };

export const createRenderTurns = (): RenderTurns => {
  const refused = busyLog();
  const spaces = new Map<number, SpaceTurns>();

  const turnsOf = (spaceId: number): SpaceTurns => {
    const existing = spaces.get(spaceId);
    if (existing) {
      return existing;
    }

    const created: SpaceTurns = { running: 0, waiting: [] };
    spaces.set(spaceId, created);

    return created;
  };

  /** Given back once, whoever calls it twice: the turn passes to the first waiting, or the count drops. */
  const releaseOf = (spaceId: number, turns: SpaceTurns): (() => void) => {
    let released = false;

    return () => {
      if (released) {
        return;
      }

      released = true;
      const next = turns.waiting.shift();
      if (next) {
        next(releaseOf(spaceId, turns));

        return;
      }

      turns.running--;
      if (turns.running === 0) {
        spaces.delete(spaceId);
      }
    };
  };

  const tryTake = (spaceId: number, limit: number): (() => void) | undefined => {
    const turns = turnsOf(spaceId);
    if (turns.running >= limit) {
      return undefined;
    }

    turns.running++;

    return releaseOf(spaceId, turns);
  };

  const take = (spaceId: number, limit: number, waitMs: number): Promise<(() => void) | undefined> => {
    const now = tryTake(spaceId, limit);
    if (now || waitMs <= 0) {
      return Promise.resolve(now);
    }

    const turns = turnsOf(spaceId);

    return new Promise(resolve => {
      const waiter = (release: () => void) => {
        clearTimeout(timer);
        resolve(release);
      };
      const timer = setTimeout(() => {
        turns.waiting.splice(turns.waiting.indexOf(waiter), 1);
        resolve(undefined);
      }, waitMs);
      turns.waiting.push(waiter);
    });
  };

  return { take, tryTake, running: spaceId => spaces.get(spaceId)?.running ?? 0, refused };
};

/** How long a page past its space's limit waits for a turn, unless the server says (`renderLimit.waitMs`). */
export const DEFAULT_RENDER_WAIT_MS = 2000;

const isCount = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value >= 1;

/** The server's `renderLimit`, refused at boot when it says no count — rather than a space that never renders. */
export const renderLimitOf = (config: SSRRenderLimitConfig | undefined): SSRRenderLimitConfig | undefined => {
  if (!config) {
    return undefined;
  }

  if (config.perSpace !== undefined && !isCount(config.perSpace)) {
    throw new Error(
      `renderLimit.perSpace: ${String(config.perSpace)} is no count of renders — write a whole number, 1 or more`
    );
  }

  if (config.waitMs !== undefined && !(Number.isFinite(config.waitMs) && config.waitMs >= 0)) {
    throw new Error(`renderLimit.waitMs: ${String(config.waitMs)} is no wait — write milliseconds, 0 or more`);
  }

  return { ...config, waitMs: config.waitMs ?? DEFAULT_RENDER_WAIT_MS };
};

/** The limit a page of `deployment` renders under: its own, else the server's; none without either. */
export const renderLimitFor = (
  deployment: SSRSpaceDeployment | undefined,
  config: SSRRenderLimitConfig | undefined
): number | undefined => {
  const own = deployment?.renderLimit;
  if (own !== undefined) {
    if (isCount(own)) {
      return own;
    }

    serverLog.warn(
      'SSR render limit',
      `space ${String(deployment?.spaceId)}: renderLimit ${String(own)} is no count of renders — the server's is used`
    );
  }

  return config?.perSpace;
};

/**
 * The pages of each space answered 503 for want of a turn, said once a minute per space with how many: a burst is
 * thousands of them, and one line each would bury everything else the server says.
 */
export const busyLog = (now: () => number = Date.now) => {
  const said = new Map<number, { at: number; count: number }>();

  return (spaceId: number, limit: number): void => {
    const last = said.get(spaceId);
    if (last && now() - last.at < 60_000) {
      last.count++;

      return;
    }

    const count = (last?.count ?? 0) + 1;
    said.set(spaceId, { at: now(), count: 0 });
    serverLog.warn(
      'SSR render limit',
      `space ${String(spaceId)}: ${String(count)} page${count === 1 ? '' : 's'} answered 503 — ${String(limit)} of its pages were rendering already (renderLimit)`
    );
  };
};
