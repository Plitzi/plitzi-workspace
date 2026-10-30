// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';

import { answered, dragElement, giveValue, hiddenAtWidth, shownCopy, valueFieldIn } from './act';

import type { E2eElement, E2eLocator, E2ePage } from './page';
import type { SettlingRequest } from '../settle';

type Box = { x: number; y: number; width: number; height: number } | null;

/** An element of a fake page: its box (null, hidden) and what was done to it. */
const elementOf = (box: Box, done: string[], name: string): E2eElement => ({
  count: () => Promise.resolve(1),
  click: () => Promise.resolve(void done.push(`click ${name}`)),
  hover: () => Promise.resolve(void done.push(`hover ${name}`)),
  fill: text => Promise.resolve(void done.push(`fill ${name} ${text}`)),
  selectOption: value => Promise.resolve(done.push(`select ${name} ${value}`)),
  boundingBox: () => Promise.resolve(box)
});

/** A page whose selectors each find copies with these boxes. */
const pageOf = (copies: Record<string, Box[]>, done: string[] = []): Pick<E2ePage, 'locator'> => ({
  locator: (selector: string): E2eLocator => {
    const boxes = copies[selector] ?? [];
    const nth = (index: number): E2eElement =>
      index >= 0 && index < boxes.length
        ? elementOf(boxes[index] ?? null, done, `${selector}#${String(index + 1)}`)
        : { ...elementOf(null, done, selector), count: () => Promise.resolve(0) };

    return {
      ...nth(0),
      count: () => Promise.resolve(boxes.length),
      first: () => nth(0),
      last: () => nth(boxes.length - 1),
      nth
    };
  }
});

const BOX = { x: 10, y: 20, width: 200, height: 20 };

describe('the copy a press acts on', () => {
  it('is the first a visitor sees when none is named — the phone’s copy hidden at this width is passed over', async () => {
    const done: string[] = [];
    const found = await shownCopy(pageOf({ '.field': [null, BOX] }, done), '.field');
    expect(found).toMatchObject({ at: 1, copies: 2 });
    if ('element' in found) {
      await found.element.click({ timeout: 1 });
    }

    expect(done).toEqual(['click .field#2']);
  });

  it('says one on the page and shown nowhere apart from one not on it, and takes the copy named', async () => {
    const page = pageOf({ '.menu': [null, null], '.row': [BOX, BOX, null] });
    expect(await shownCopy(page, '.menu')).toEqual({ hidden: true });
    expect(await shownCopy(page, '.nothing')).toEqual({ absent: true });
    expect(await shownCopy(page, '.row', 'last')).toEqual({ hidden: true });
    expect(await shownCopy(page, '.row', 2)).toMatchObject({ at: 1, copies: 3 });
    expect(await shownCopy(page, '.row', 9)).toEqual({ absent: true });
    expect(hiddenAtWidth('nav-burger', 'click')).toContain('nav-burger is on the page but hidden at this width');
  });
});

// A run's scout typed `2026-10-29` and `10292026` into a date field and its onChange never ran: keys land in a segment.
describe('a field given a value whole', () => {
  it('is a select chosen from, or a date, time, colour or range set — the one named or the one inside it', () => {
    document.body.innerHTML = [
      '<div data-plitzi-el="when"><label>Date</label><input type="date"></div>',
      '<input data-plitzi-el="at" type="time">',
      '<div data-plitzi-el="genre"><select><option>a</option></select></div>',
      '<div data-plitzi-el="title"><input type="text"></div>',
      '<div data-plitzi-el="both"><input type="date"><input type="time"></div>'
    ].join('');

    expect(valueFieldIn('[data-plitzi-el="when"]')).toEqual({
      selector: '[data-plitzi-el="when"] input[type="date"]',
      how: 'value'
    });
    expect(valueFieldIn('[data-plitzi-el="at"]')).toEqual({ selector: '[data-plitzi-el="at"]', how: 'value' });
    expect(valueFieldIn('[data-plitzi-el="genre"]')).toEqual({
      selector: '[data-plitzi-el="genre"] select',
      how: 'select'
    });
    expect(valueFieldIn('[data-plitzi-el="title"]')).toBeUndefined();
    // Two fields inside: which one is the step's to name.
    expect(valueFieldIn('[data-plitzi-el="both"]')).toBeUndefined();
    // A selector only a browser driver reads is typed into as it is.
    expect(valueFieldIn('[data-plitzi-el="genre"] >> nth=1')).toBeUndefined();
  });
});

describe('a value given, not typed', () => {
  it('chooses a select’s option, sets a date — and leaves a text field to be typed in', async () => {
    const done: string[] = [];
    const answers: Record<string, { selector: string; how: 'select' | 'value' } | undefined> = {
      '#size': { selector: '#size select', how: 'select' },
      '#when': { selector: '#when', how: 'value' },
      '#name': undefined
    };
    const page = {
      ...pageOf({ '#size select': [BOX], '#when': [BOX] }, done),
      evaluate: <R, A>(_fn: (arg: A) => R | Promise<R>, selector: A) =>
        // The fake answers what `valueFieldIn` reads in a browser, by the selector it was given.
        Promise.resolve(answers[String(selector)] as R)
    };

    expect(await giveValue(page, '#size', 'Large')).toBe(true);
    expect(await giveValue(page, '#when', '2026-10-30')).toBe(true);
    expect(await giveValue(page, '#name', 'Ana')).toBe(false);
    expect(done).toEqual(['select #size select#1 Large', 'fill #when#1 2026-10-30']);
  });
});

describe('a drag', () => {
  it('presses a range at its thumb, moves as a hand would, and keeps the finger down when held', async () => {
    const moves: string[] = [];
    const page = {
      // The fake range's value sits at a quarter of its track: what `thumbAlong` reads in a browser, answered as its R.
      evaluate: <R>() => Promise.resolve(0.25 as R),
      mouse: {
        move: (x: number, y: number) => Promise.resolve(void moves.push(`move ${String(x)},${String(y)}`)),
        down: () => Promise.resolve(void moves.push('down')),
        up: () => Promise.resolve(void moves.push('up')),
        wheel: () => Promise.resolve()
      }
    };
    const range = elementOf(BOX, [], 'range');

    expect(await dragElement(page, range, '#price', { dx: 40, dy: 0, held: true })).toBeUndefined();
    // The thumb, 20 px wide, travels 180 px: a quarter along is 45 px past its half-width.
    expect(moves).toEqual(['move 65,30', 'down', 'move 105,30']);
    expect(await dragElement(page, elementOf(null, [], 'gone'), '#gone', { dx: 1, dy: 0 })).toBe(
      'it is not shown — nothing to drag'
    );
  });
});

// The down key, lit by the vote's answer, measured unlit — the page was read before the action landed.
describe('a press the server answers', () => {
  it('is waited for when the answer comes later', async () => {
    const listeners = new Map<string, Set<(request: SettlingRequest) => void>>();
    const emit = (event: string, request: SettlingRequest): void => {
      for (const listener of listeners.get(event) ?? []) {
        listener(request);
      }
    };
    const page = {
      on: (event: string, listener: (request: SettlingRequest) => void) =>
        listeners.set(event, new Set([...(listeners.get(event) ?? []), listener])),
      off: (event: string, listener: (request: SettlingRequest) => void) => listeners.get(event)?.delete(listener),
      waitForTimeout: (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))
    };
    const vote: SettlingRequest = { url: () => '/_action', resourceType: () => 'fetch', headers: () => ({}) };
    let landed = false;

    await answered(page, () => {
      emit('request', vote);
      setTimeout(() => {
        landed = true;
        emit('requestfinished', vote);
      }, 120);

      return Promise.resolve();
    });

    expect(landed).toBe(true);
  });

  it('waits for what the press asked, and not for a stream that never ends', async () => {
    const listeners = new Map<string, (request: SettlingRequest) => void>();
    const request = (type: string, accept = ''): SettlingRequest => ({
      url: () => '/x',
      resourceType: () => type,
      headers: () => ({ accept })
    });
    const call = request('fetch');
    const waits = vi.fn(() => {
      listeners.get('requestfinished')?.(call);

      return Promise.resolve();
    });
    const page = {
      on: (event: string, listener: (request: SettlingRequest) => void) => listeners.set(event, listener),
      off: (event: string) => listeners.delete(event),
      waitForTimeout: waits
    };

    await answered(page, () => {
      listeners.get('request')?.(call);
      listeners.get('request')?.(request('fetch', 'text/event-stream'));

      return Promise.resolve();
    });
    expect(waits).toHaveBeenCalledTimes(1);
    expect(listeners.size).toBe(0);
  });
});
