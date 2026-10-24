import { describe, expect, it } from 'vitest';

import { along, chartRows, chartScale, chartSlices } from './chartGeometry';

describe('a chart’s rows', () => {
  it('reads records by their fields, plain numbers by their place, and leaves out what is no number', () => {
    expect(
      chartRows(
        [{ day: 'Mon', plays: 4 }, { day: 'Tue', plays: '7' }, { day: 'Wed', plays: 'n/a' }, { plays: 2 }],
        'day',
        'plays'
      )
    ).toEqual([
      { label: 'Mon', value: 4 },
      { label: 'Tue', value: 7 },
      { label: '4', value: 2 }
    ]);
    expect(chartRows([3, 'x', 5], 'label', 'value')).toEqual([
      { label: '1', value: 3 },
      { label: '3', value: 5 }
    ]);
    expect(chartRows(undefined, 'label', 'value')).toEqual([]);
  });
});

describe('a chart’s scale', () => {
  it('starts at zero and ends on a round step above the highest', () => {
    expect(
      chartScale([
        { label: 'a', value: 7 },
        { label: 'b', value: 13 }
      ])
    ).toEqual({
      min: 0,
      max: 15,
      ticks: [0, 5, 10, 15]
    });
  });

  it('reaches below zero for a negative value, and takes a top it is given', () => {
    expect(
      chartScale([
        { label: 'a', value: -3 },
        { label: 'b', value: 4 }
      ]).min
    ).toBeLessThan(0);
    expect(chartScale([{ label: 'a', value: 42 }], 100).max).toBe(100);
  });

  it('places a value along the axis', () => {
    expect(along(5, { min: 0, max: 10 }, 200, 0)).toBe(100);
  });
});

describe('a donut’s slices', () => {
  it('are each row’s share of the whole, one after another — what has no share left out', () => {
    expect(
      chartSlices([
        { label: 'a', value: 1 },
        { label: 'b', value: 3 },
        { label: 'c', value: -2 }
      ]).map(({ row, start, share }) => [row.label, start, share])
    ).toEqual([
      ['a', 0, 0.25],
      ['b', 0.25, 0.75]
    ]);
  });
});
