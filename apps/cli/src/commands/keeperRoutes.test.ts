import { describe, expect, it } from 'vitest';

import { keeperRoutes, MAX_SESSIONS, SESSION_IDLE_MS } from './keeperRoutes';

import type { KeeperDeps } from './keeperRoutes';

const colour = { text: 'rgb(0, 0, 0)', ground: 'rgb(255, 255, 255)' };

/** A page as the test knows it: its number, what was done on it, and whether it was closed. */
interface Page {
  id: number;
  done: string[];
  closed: boolean;
}

const view = { url: 'https://site.test/', width: 390, height: 900 };

/** The id a held page was given, from what opening it answered. */
const sessionOf = (held: unknown): string => {
  const session: unknown = typeof held === 'object' && held !== null ? Reflect.get(held, 'session') : undefined;
  if (typeof session !== 'string') {
    throw new Error('no page was held');
  }

  return session;
};

/** The routes over pages the test makes and reads: every open a new one, its time the test's to move. */
const bench = (overrides: Partial<KeeperDeps<Page>> = {}) => {
  const opened: Page[] = [];
  let time = 0;
  const routes = keeperRoutes<Page>({
    measure: asked => Promise.resolve({ readings: asked.targets.map(target => ({ problem: `${target} kept` })) }),
    open: () => {
      const page = { id: opened.length + 1, done: [], closed: false };
      opened.push(page);

      return Promise.resolve({ page });
    },
    measureOn: (page, target) => Promise.resolve({ problem: `${target} on page ${String(page.id)}` }),
    putIn: (page, state) => {
      page.done.push(
        `${state.kind} ${state.targets.join(', ')}${state.then ? ` then ${state.then.kind} ${state.then.target}` : ''}`
      );

      return Promise.resolve(undefined);
    },
    outline: page => Promise.resolve({ outline: { elements: [], more: page.id } }),
    act: (page, step) => {
      page.done.push(step.kind);

      return Promise.resolve(undefined);
    },
    readState: (page, target) =>
      Promise.resolve({
        offset: { x: page.done.length, y: 0 },
        shown: target !== 'hidden',
        enabled: true,
        text: '',
        aria: {},
        focused: false,
        inView: 'whole',
        colour
      }),
    close: page => {
      page.closed = true;

      return Promise.resolve();
    },
    now: () => time,
    ...overrides
  });
  const ask = async (route: string, body: unknown) => (await routes.routes[route](body)).body;

  return { routes, ask, opened, later: (ms: number) => (time += ms) };
};

// lx-product: a stateful read of the other site — a click, a play, an outline — launched and loaded it cold each time,
// 10–17 s a call, where a kept one reads in 1–2.
describe('the kept browser’s routes', () => {
  it('reads a state on a page of its own, closed after — a plain reading from the pages kept', async () => {
    const { ask, opened } = bench();

    expect(await ask('/measure', { ...view, targets: ['h1'] })).toEqual({ readings: [{ problem: 'h1 kept' }] });
    expect(opened).toEqual([]);
    expect(
      await ask('/measure', { ...view, targets: ['#menu', '.panel'], state: { kind: 'click', targets: ['#toggle'] } })
    ).toEqual({ readings: [{ problem: '#menu on page 1' }, { problem: '.panel on page 1' }] });
    expect(opened).toEqual([{ id: 1, done: ['click #toggle'], closed: true }]);

    // A menu opened, then an item of it hovered: the hover goes with the clicks, after them.
    await ask('/measure', {
      ...view,
      targets: ['.item'],
      state: { kind: 'click', targets: ['#avatar'], then: { kind: 'hover', target: '.item' } }
    });
    expect(opened.at(-1)?.done).toEqual(['click #avatar then hover .item']);
  });

  it('outlines the other page on a page of its own, and refuses an ask it cannot read', async () => {
    const { ask, opened, routes } = bench();

    expect(await ask('/outline', { ...view, clicks: ['#toggle'], depth: 4, limit: 120, words: 32 })).toEqual({
      outline: { elements: [], more: 1 }
    });
    expect(opened[0]?.closed).toBe(true);
    expect(await routes.routes['/outline']({ url: 'x' })).toMatchObject({ status: 400 });
    expect(
      await routes.routes['/measure']({ ...view, targets: ['h1'], state: { kind: 'drag', targets: [] } })
    ).toMatchObject({ status: 400 });
    expect(
      await routes.routes['/measure']({
        ...view,
        targets: ['h1'],
        state: { kind: 'click', targets: ['#a'], then: { kind: 'drag', target: '#b' } }
      })
    ).toMatchObject({ status: 400 });
  });

  it('holds a page for a play — stepped, read, closed — and answers a step of a closed one with why', async () => {
    const { ask, opened, routes } = bench();
    const session = sessionOf(await ask('/session/open', view));

    expect(await ask('/session/act', { session, step: { kind: 'click', target: '#next' }, index: 0 })).toEqual({
      done: true
    });
    expect(await ask('/session/read', { session, targets: ['#row', 'hidden'] })).toEqual({
      states: [
        {
          offset: { x: 1, y: 0 },
          shown: true,
          enabled: true,
          text: '',
          aria: {},
          focused: false,
          inView: 'whole',
          colour
        },
        {
          offset: { x: 1, y: 0 },
          shown: false,
          enabled: true,
          text: '',
          aria: {},
          focused: false,
          inView: 'whole',
          colour
        }
      ]
    });
    expect(await routes.routes['/session/act']({ session, step: { kind: 'fly' }, index: 0 })).toMatchObject({
      status: 400
    });
    await ask('/session/close', { session });

    expect(opened[0]?.closed).toBe(true);
    expect(routes.sessions()).toBe(0);
    expect(await ask('/session/act', { session, step: { kind: 'press', key: 'Escape' }, index: 1 })).toEqual({
      problem: expect.stringContaining('no such page held') as unknown
    });
  });

  it('holds a handful of pages at most, and closes one unused past a minute — never one being stepped', async () => {
    let release: () => void = () => undefined;
    const { ask, opened, routes, later } = bench({
      act: () =>
        new Promise(resolve => {
          release = () => resolve(undefined);
        })
    });
    const sessions: string[] = [];
    for (let index = 0; index < MAX_SESSIONS; index += 1) {
      sessions.push(sessionOf(await ask('/session/open', view)));
    }

    expect(await ask('/session/open', view)).toEqual({ problem: expect.stringContaining('held for plays') as unknown });

    // One busy with a step while the minute passes: the sweep leaves it, and closes the rest.
    const stepping = ask('/session/act', { session: sessions[0], step: { kind: 'click', target: '#a' }, index: 0 });
    later(SESSION_IDLE_MS + 1);
    await routes.sweep();
    expect(routes.sessions()).toBe(1);
    expect(opened.filter(page => page.closed)).toHaveLength(MAX_SESSIONS - 1);
    release();
    await stepping;

    await routes.closeAll();
    expect(opened.every(page => page.closed)).toBe(true);
  });
});
