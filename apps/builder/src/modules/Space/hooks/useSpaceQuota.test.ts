import { describe, expect, it } from 'vitest';

import { readingsFor } from './useSpaceQuota';

import type { TQuotaPlane, TSpaceQuota } from '@plitzi/sdk-shared';

const plane = (over: Partial<TQuotaPlane> = {}): TQuotaPlane => ({
  views: 0,
  viewsQuota: 0,
  viewsUnlimited: true,
  viewsPercent: null,
  viewsRemaining: null,
  elements: null,
  elementsQuota: 0,
  elementsUnlimited: true,
  elementsPercent: null,
  overLimit: false,
  ...over
});

const quota = (space: Partial<TQuotaPlane>, account: Partial<TQuotaPlane> = {}): TSpaceQuota => ({
  planName: 'Pro',
  tier: 'paid',
  isFree: false,
  periodStart: 0,
  periodEnd: 0,
  space: plane(space),
  account: plane(account),
  overLimit: false
});

const find = (readings: ReturnType<typeof readingsFor>, id: string) => readings.find(entry => entry.id === id);

describe('useSpaceQuota — what the meter reads', () => {
  it('counts elements off the LIVE schema, not off what the server last saw', () => {
    // The whole point of the meter being in the editor: the server's figure is whatever was last saved, and the
    // count on screen has to move with the element someone just dropped.
    const readings = readingsFor(quota({ elements: 400, elementsQuota: 1_000 }), 462);

    expect(find(readings, 'space:elements')).toMatchObject({ used: 462, quota: 1_000, level: 'ok' });
  });

  it('swaps the saved count for this space out of the account total, and the live one in', () => {
    // The account holds 900 elements, 400 of them in this space. Adding 200 here makes it 1 100, and the builder
    // cannot ask the server for that number every keystroke — but it can do the arithmetic.
    const readings = readingsFor(
      quota({ elements: 400, elementsQuota: 1_000 }, { elements: 900, elementsQuota: 5_000 }),
      600
    );

    expect(find(readings, 'account:elements')).toMatchObject({ used: 1_100, quota: 5_000 });
  });

  it('warns before the ceiling, and reports crossing it', () => {
    const near = readingsFor(quota({ elements: 0, elementsQuota: 1_000 }), 900);
    expect(find(near, 'space:elements')?.level).toBe('near');

    const under = readingsFor(quota({ elements: 0, elementsQuota: 1_000 }), 899);
    expect(find(under, 'space:elements')?.level).toBe('ok');

    const over = readingsFor(quota({ elements: 0, elementsQuota: 1_000 }), 1_001);
    expect(find(over, 'space:elements')?.level).toBe('over');
  });

  it('reports nothing for a ceiling the plan does not enforce', () => {
    // A quota of 0 is "unlimited". Drawing a bar against it reads as full, and warning about it is a lie.
    const readings = readingsFor(quota({ elements: 0, elementsQuota: 0, viewsQuota: 0 }), 50_000);

    expect(readings).toEqual([]);
  });

  it('keeps the two planes apart, each against its own ceiling', () => {
    const readings = readingsFor(
      quota(
        { views: 24_000, viewsQuota: 25_000, elements: 100, elementsQuota: 1_000 },
        { views: 24_000, viewsQuota: 100_000, elements: 100, elementsQuota: 5_000 }
      ),
      100
    );

    // The same 24 000 page views are 96% of what this space may spend and 24% of what the account may.
    expect(find(readings, 'space:views')).toMatchObject({ level: 'near' });
    expect(find(readings, 'account:views')).toMatchObject({ level: 'ok' });
  });
});
