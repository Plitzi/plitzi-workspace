import { afterEach, describe, expect, it, vi } from 'vitest';

import { playE2eStep } from './play';

import type { E2ePage } from './page';
import type { StepPlay } from './play';

const ctx: StepPlay = { origin: 'http://127.0.0.1:8080', clockHeld: false };

/** What an element of the fake page did: the presses it took, and with what. */
interface Pressed {
  click: unknown[];
  fill: string[];
}

/**
 * A page as a step meets it: hydrated, settled at once, every element shown at 200×100 — its words `text`, how many
 * copies `copies` — and whatever runs in it answered by `inPage` (an element read, a source written, a scroll).
 */
const fakePage = ({
  text = '',
  copies = 1,
  shown = true,
  inPage
}: { text?: string; copies?: number; shown?: boolean; inPage?: (arg: unknown) => unknown } = {}) => {
  const pressed: Pressed = { click: [], fill: [] };
  const element = {
    count: () => Promise.resolve(1),
    boundingBox: () => Promise.resolve(shown ? { x: 0, y: 0, width: 200, height: 100 } : null),
    click: (options: unknown) => {
      pressed.click.push(options);

      return Promise.resolve();
    },
    hover: () => Promise.resolve(),
    // Read in the page on the element: an element read (`attribute`), a scroll, a point's hit — or `inPage`'s answer.
    evaluate: (_fn: unknown, arg: unknown) =>
      Promise.resolve(
        inPage?.(arg) ??
          (typeof arg === 'object' && arg !== null && 'attribute' in arg
            ? { shown, text, attribute: null, style: '', box: null }
            : arg === null || (typeof arg === 'object' && 'dx' in arg)
              ? { moved: true, across: 0, down: 0 }
              : undefined)
      ),
    fill: (value: string) => {
      pressed.fill.push(value);

      return Promise.resolve();
    },
    selectOption: () => Promise.resolve([])
  };
  const page = {
    waitForSelector: () => Promise.resolve({}),
    waitForTimeout: () => Promise.resolve(),
    locator: () => ({
      ...element,
      count: () => Promise.resolve(copies),
      first: () => element,
      last: () => element,
      nth: () => element,
      filter: () => ({ first: () => element })
    }),
    // What runs in the page itself: settling (`most`) answers nothing, a field given no value of its own (`false`).
    evaluate: (_fn: unknown, arg: unknown) =>
      Promise.resolve(typeof arg === 'object' && arg !== null && 'most' in arg ? undefined : false),
    on: () => undefined,
    off: () => undefined
  };

  // The fake answers what a step asks of a page, and nothing else a page has.
  return { page: page as unknown as E2ePage, pressed };
};

afterEach(() => {
  vi.useRealTimers();
});

// One player for a journey and a page command's steps: what each learnt, the other has.
describe('a journey’s step played', () => {
  // A quake on a map's canvas has no element of its own: a run's tester wrote a probe to press one.
  it('presses a point of a box, in px from its top left — the centre when none is said', async () => {
    const { page, pressed } = fakePage();
    await playE2eStep(page, { kind: 'click', element: 'map', point: { x: 30, y: 60 } }, ctx);
    await playE2eStep(page, { kind: 'click', element: 'map' }, ctx);

    expect(pressed.click).toEqual([{ timeout: 3000, position: { x: 60, y: 60 } }, { timeout: 3000 }]);
  });

  // A point is for what a canvas draws: a marker drawn as HTML over it is named, and found wherever it is.
  it('says when a point lands on an element drawn as HTML, and how to name it', async () => {
    const { page } = fakePage({
      inPage: arg =>
        typeof arg === 'object' && arg !== null && 'x' in arg ? { said: '.map-marker', words: 'ARNAB' } : undefined
    });

    expect(await playE2eStep(page, { kind: 'click', element: 'map', point: { x: 30, y: 60 } }, ctx)).toEqual({
      note: 'the point landed on .map-marker ("ARNAB"), drawn as HTML: name it — click \'.map-marker\' — and the press finds it wherever it is; a point is for what a canvas draws'
    });
  });

  // A tester's `fill room-rules-remove-at ''` left a number field at 5: what a field held is replaced, emptied too.
  it('types in place of what the field held', async () => {
    const { page, pressed } = fakePage();
    await playE2eStep(page, { kind: 'type', element: 'rate', text: '' }, ctx);

    expect(pressed.fill).toEqual(['']);
  });

  // A tester's toggle test ran on the wrong panel: nothing said the name matched more than one.
  it('says which of several copies it pressed, and how to name another', async () => {
    expect(await playE2eStep(fakePage({ copies: 3 }).page, { kind: 'click', element: 'section-header' }, ctx)).toEqual({
      note: 'section-header is on the page 3 times: this pressed the first a visitor sees — section-header:2 … section-header:last names another'
    });
  });

  it('waits for an element as long as it says, 10 s when it says nothing', async () => {
    vi.useFakeTimers({ now: 0 });
    const { page } = fakePage({ shown: false });
    // Time passes as the page is waited on.
    Object.assign(page, {
      waitForTimeout: (ms: number) => {
        vi.setSystemTime(Date.now() + ms);

        return Promise.resolve();
      }
    });

    expect(await playE2eStep(page, { kind: 'waitFor', element: 'player' }, ctx)).toEqual({
      problem: 'player was not shown within 10 s'
    });
    expect(Date.now()).toBeGreaterThanOrEqual(10_000);
    expect(await playE2eStep(page, { kind: 'waitFor', element: 'player', ms: 40_000 }, ctx)).toEqual({
      problem: 'player was not shown within 40 s'
    });
  });

  it('holds what must hold for its time, and says what it read when it does not', async () => {
    expect(
      await playE2eStep(
        fakePage({ text: '0 items' }).page,
        { kind: 'expectText', element: 'cart-count', text: '1 item' },
        { ...ctx, expectMs: 0 }
      )
    ).toEqual({ problem: 'it reads "0 items"' });
    expect(
      await playE2eStep(
        fakePage({ text: '1 item' }).page,
        { kind: 'expectText', element: 'cart-count', text: '1 item', exact: true },
        ctx
      )
    ).toBeUndefined();
  });

  // A page command names an element by a selector or a row; a journey by its id: each says where it is its own way.
  it('finds an element the way its player names one, and reads it through its driver', async () => {
    const { page } = fakePage();
    const asked: string[] = [];
    const locator = page.locator.bind(page);
    Object.assign(page, {
      locator: (selector: string) => {
        asked.push(selector);

        return locator(selector);
      }
    });
    await playE2eStep(page, { kind: 'expectShown', element: 'room-card:2' }, { ...ctx, expectMs: 0 });
    await playE2eStep(
      page,
      { kind: 'expectShown', element: 'button:has-text("24H")' },
      {
        ...ctx,
        expectMs: 0,
        locate: target => Promise.resolve({ selector: target, copy: undefined })
      }
    );

    // A selector only the driver reads (`:has-text()`) is read as a press finds it — never by the page's own query.
    expect([...new Set(asked)]).toEqual(['[data-plitzi-el="room-card"]', 'button:has-text("24H")']);
  });
});
