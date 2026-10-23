import { randomBytes } from 'node:crypto';

import { isRecord } from '@plitzi/sdk-shared/helpers';

import { problem } from './keeperServer';

import type { RouteAnswer, Route } from './keeperServer';
import type { Measured } from './measureValues';
import type { ElementState } from './play';
import type { ActingStep } from './shot/steps';
import type { KeptAnswer, KeptAsk, KeptOutlineAnswer, KeptOutlineAsk, KeptView } from '../browser/keptBrowser';

/**
 * What the kept browser answers, route by route — `measureKeeper.ts` gives it the browser: a reading of the other
 * page's elements, kept loaded between calls (`keptPages.ts`); one in a state, or an outline, on a page of its own that
 * nobody else reads, opened warm and closed; and a page held for one command's play — opened, stepped, read, closed —
 * each its own session, closed once unused a minute, a handful at most.
 *
 * lx-product: a stateful read of the other site — `--click`, `page play`, `page outline --compare` — launched a browser
 * and loaded the site cold every time, 10–17 s a call, where a kept one reads in 1–2.
 */

export interface KeeperDeps<P> {
  /** A reading of pages kept between calls: no state, never one others read in. */
  measure: (asked: KeptAsk) => Promise<KeptAnswer>;
  /** A page of the other site opened warm, as the view asks, for one ask alone. */
  open: (view: KeptView) => Promise<{ page: P } | { problem: string }>;
  measureOn: (page: P, target: string) => Promise<Measured | { problem: string }>;
  /** Elements hovered, focused or clicked in turn, what each starts finished. */
  putIn: (page: P, state: NonNullable<KeptAsk['state']>) => Promise<{ problem: string } | undefined>;
  outline: (page: P, asked: KeptOutlineAsk) => Promise<KeptOutlineAnswer>;
  /** A step of a play, what it starts finished. */
  act: (page: P, step: ActingStep, index: number) => Promise<{ problem: string } | undefined>;
  readState: (page: P, target: string) => Promise<ElementState | { problem: string }>;
  close: (page: P) => Promise<void>;
  now?: () => number;
}

/** The pages held for plays at once, at most: past it, a play opens its page itself. */
export const MAX_SESSIONS = 8;

/** How long a play's page is held unused before it is closed: a command that died never leaves one open. */
export const SESSION_IDLE_MS = 60_000;

const isStrings = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every(each => typeof each === 'string');

const isView = (value: unknown): value is KeptView =>
  isRecord(value) &&
  typeof value.url === 'string' &&
  typeof value.width === 'number' &&
  typeof value.height === 'number' &&
  (value.scheme === undefined || value.scheme === 'light' || value.scheme === 'dark') &&
  (value.reducedMotion === undefined || typeof value.reducedMotion === 'boolean');

const STATE_KINDS: readonly string[] = ['hover', 'focus', 'click'];

const isAsk = (value: unknown): value is KeptAsk =>
  isRecord(value) &&
  isView(value) &&
  isStrings(value.targets) &&
  (value.fresh === undefined || typeof value.fresh === 'boolean') &&
  (value.state === undefined ||
    (isRecord(value.state) &&
      typeof value.state.kind === 'string' &&
      STATE_KINDS.includes(value.state.kind) &&
      isStrings(value.state.targets)));

const isOutlineAsk = (value: unknown): value is KeptOutlineAsk =>
  isRecord(value) &&
  isView(value) &&
  (value.clicks === undefined || isStrings(value.clicks)) &&
  (value.within === undefined || typeof value.within === 'string') &&
  typeof value.depth === 'number' &&
  typeof value.limit === 'number' &&
  typeof value.words === 'number';

/** A step as `--steps` parses one: its kind, and what that kind takes. */
const isStep = (value: unknown): value is ActingStep => {
  if (!isRecord(value) || typeof value.kind !== 'string') {
    return false;
  }

  switch (value.kind) {
    case 'click':
    case 'hover':
    case 'scroll':
    case 'wait-for':
      return typeof value.target === 'string';
    case 'type':
      return typeof value.target === 'string' && typeof value.text === 'string';
    case 'drag':
      return typeof value.target === 'string' && typeof value.dx === 'number' && typeof value.dy === 'number';
    case 'press':
      return typeof value.key === 'string';
    case 'wait':
      return typeof value.ms === 'number';
    default:
      return false;
  }
};

const ok = (body: unknown): RouteAnswer => ({ status: 200, body });

const unread = (why: string): RouteAnswer => ({ status: 400, body: problem(why) });

export const keeperRoutes = <P>(deps: KeeperDeps<P>) => {
  const now = deps.now ?? Date.now;
  const sessions = new Map<string, { page: P; used: number; busy: boolean }>();

  /** A page of its own for one ask: opened, worked on, closed whatever happens. */
  const onPageOfItsOwn = async <T>(view: KeptView, work: (page: P) => Promise<T>): Promise<T | { problem: string }> => {
    const opened = await deps.open(view);
    if ('problem' in opened) {
      return opened;
    }

    try {
      return await work(opened.page);
    } finally {
      await deps.close(opened.page).catch(() => undefined);
    }
  };

  const measure: Route = async asked => {
    if (!isAsk(asked)) {
      return unread('an ask without its page and elements');
    }

    const { state } = asked;
    if (state === undefined) {
      return ok(await deps.measure(asked));
    }

    return ok(
      await onPageOfItsOwn(asked, async page => {
        const notPut = await deps.putIn(page, state);
        const readings: (Measured | { problem: string })[] = [];
        for (const target of asked.targets) {
          readings.push(notPut ?? (await deps.measureOn(page, target)));
        }

        return { readings };
      })
    );
  };

  const outline: Route = async asked =>
    isOutlineAsk(asked)
      ? ok(await onPageOfItsOwn(asked, page => deps.outline(page, asked)))
      : unread('an outline ask without its page and depth');

  /** A session asked by its id, marked in use while it is worked on: a sweep never closes it under its step. */
  const held = async <T>(asked: unknown, work: (page: P) => Promise<T>): Promise<RouteAnswer> => {
    const id = isRecord(asked) && typeof asked.session === 'string' ? asked.session : undefined;
    const session = id === undefined ? undefined : sessions.get(id);
    if (!session) {
      return ok(problem('no such page held: it was closed — unused past a minute, or the kept browser stopped'));
    }

    session.busy = true;
    try {
      return ok(await work(session.page));
    } finally {
      session.busy = false;
      session.used = now();
    }
  };

  const routes: Record<string, Route> = {
    '/measure': measure,
    '/outline': outline,
    '/session/open': async asked => {
      if (!isView(asked)) {
        return unread('a page to hold without its address and width');
      }

      if (sessions.size >= MAX_SESSIONS) {
        return ok(problem(`${String(MAX_SESSIONS)} pages are held for plays already`));
      }

      const opened = await deps.open(asked);
      if ('problem' in opened) {
        return ok(opened);
      }

      const session = randomBytes(8).toString('hex');
      sessions.set(session, { page: opened.page, used: now(), busy: false });

      return ok({ session });
    },
    '/session/act': async asked => {
      const step = isRecord(asked) && isStep(asked.step) ? asked.step : undefined;
      const index = isRecord(asked) && typeof asked.index === 'number' ? asked.index : undefined;
      if (step === undefined || index === undefined) {
        return unread('a step without its kind, its element or its place');
      }

      return held(asked, async page => (await deps.act(page, step, index)) ?? { done: true });
    },
    '/session/read': async asked => {
      const targets = isRecord(asked) && isStrings(asked.targets) ? asked.targets : undefined;
      if (targets === undefined) {
        return unread('a read without its elements');
      }

      return held(asked, async page => {
        const states: (ElementState | { problem: string })[] = [];
        for (const target of targets) {
          states.push(await deps.readState(page, target));
        }

        return { states };
      });
    },
    '/session/close': async asked => {
      const id = isRecord(asked) && typeof asked.session === 'string' ? asked.session : undefined;
      const session = id === undefined ? undefined : sessions.get(id);
      if (id !== undefined && session) {
        sessions.delete(id);
        await deps.close(session.page).catch(() => undefined);
      }

      return ok({ done: true });
    }
  };

  return {
    routes,
    /** Closes the pages held unused past `SESSION_IDLE_MS` — never one a step is being worked on. */
    sweep: async (): Promise<void> => {
      for (const [id, session] of sessions) {
        if (!session.busy && now() - session.used > SESSION_IDLE_MS) {
          sessions.delete(id);
          await deps.close(session.page).catch(() => undefined);
        }
      }
    },
    /** Every page held, closed: the kept browser on its way out. */
    closeAll: async (): Promise<void> => {
      const all = [...sessions.values()];
      sessions.clear();
      await Promise.all(all.map(session => deps.close(session.page).catch(() => undefined)));
    },
    sessions: (): number => sessions.size
  };
};
