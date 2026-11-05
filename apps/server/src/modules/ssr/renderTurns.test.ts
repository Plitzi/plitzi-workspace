import { afterEach, describe, expect, it, vi } from 'vitest';

import { serverLog } from '@plitzi/sdk-kernel/log';

import { busyLog, createRenderTurns, renderLimitFor, renderLimitOf } from './renderTurns';

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('createRenderTurns', () => {
  it('gives a space as many turns as its limit, and each space its own', () => {
    const turns = createRenderTurns();

    expect(turns.tryTake(1, 2)).toBeDefined();
    expect(turns.tryTake(1, 2)).toBeDefined();
    expect(turns.tryTake(1, 2)).toBeUndefined();
    expect(turns.tryTake(2, 2)).toBeDefined();
    expect(turns.running(1)).toBe(2);
    expect(turns.running(2)).toBe(1);
  });

  it('hands a turn given back to the first waiting, in order', async () => {
    const turns = createRenderTurns();
    const first = turns.tryTake(1, 1);
    const order: string[] = [];
    const a = turns.take(1, 1, 1000).then(release => {
      order.push('a');

      return release;
    });
    const b = turns.take(1, 1, 1000).then(release => {
      order.push('b');

      return release;
    });

    first?.();
    (await a)?.();
    await b;

    expect(order).toEqual(['a', 'b']);
    expect(turns.running(1)).toBe(1);
  });

  it('answers none to a page that waited its time, and never hands it a turn afterwards', async () => {
    vi.useFakeTimers();
    const turns = createRenderTurns();
    const held = turns.tryTake(1, 1);
    const late = turns.take(1, 1, 100);
    await vi.advanceTimersByTimeAsync(100);

    expect(await late).toBeUndefined();

    held?.();

    expect(turns.running(1)).toBe(0);
  });

  it('counts a turn given back twice once', () => {
    const turns = createRenderTurns();
    const release = turns.tryTake(1, 2);
    turns.tryTake(1, 2);
    release?.();
    release?.();

    expect(turns.running(1)).toBe(1);
  });
});

describe('renderLimitOf / renderLimitFor', () => {
  it('refuses at boot a limit that is no count, and waits 2 s unless told', () => {
    expect(() => renderLimitOf({ perSpace: 0 })).toThrow('renderLimit.perSpace');
    expect(() => renderLimitOf({ perSpace: 1.5 })).toThrow('renderLimit.perSpace');
    expect(() => renderLimitOf({ waitMs: -1 })).toThrow('renderLimit.waitMs');
    expect(renderLimitOf({ perSpace: 4 })).toEqual({ perSpace: 4, waitMs: 2000 });
    expect(renderLimitOf(undefined)).toBeUndefined();
  });

  it('takes the deployment’s own, else the server’s — and says one it cannot use', () => {
    const warn = vi.spyOn(serverLog, 'warn').mockImplementation(() => undefined);

    expect(renderLimitFor({ spaceId: 3, renderLimit: 8 }, { perSpace: 4 })).toBe(8);
    expect(renderLimitFor({ spaceId: 3 }, { perSpace: 4 })).toBe(4);
    expect(renderLimitFor({ spaceId: 3 }, undefined)).toBeUndefined();
    expect(renderLimitFor({ spaceId: 3, renderLimit: 0 }, { perSpace: 4 })).toBe(4);
    expect(warn).toHaveBeenCalledWith('SSR render limit', expect.stringContaining('space 3: renderLimit 0'));
  });
});

describe('busyLog', () => {
  it('says the first refusal at once, then how many a minute later', () => {
    const warn = vi.spyOn(serverLog, 'warn').mockImplementation(() => undefined);
    let now = 0;
    const said = busyLog(() => now);
    said(7, 2);
    said(7, 2);
    said(7, 2);
    now = 60_000;
    said(7, 2);

    expect(warn.mock.calls.map(([, message]) => message)).toEqual([
      'space 7: 1 page answered 503 — 2 of its pages were rendering already (renderLimit)',
      'space 7: 3 pages answered 503 — 2 of its pages were rendering already (renderLimit)'
    ]);
  });
});
