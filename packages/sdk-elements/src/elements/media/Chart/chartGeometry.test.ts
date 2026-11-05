import { describe, expect, it } from 'vitest';

import {
  along,
  axisLabelIndexes,
  chartRows,
  chartScale,
  chartSegments,
  chartSeriesOf,
  chartSlices,
  chartTable,
  lineSummary
} from './chartGeometry';

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
    expect(chartScale([7, 13])).toEqual({
      min: 0,
      max: 15,
      ticks: [0, 5, 10, 15]
    });
  });

  it('reaches below zero for a negative value, and takes a top it is given', () => {
    expect(chartScale([-3, 4]).min).toBeLessThan(0);
    expect(chartScale([42], 100).max).toBe(100);
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

describe('a chart of several series', () => {
  it('keeps every row in its place, each series read by its field, a missing value a gap', () => {
    expect(
      chartTable(
        [
          { at: '12:00', a: 1, b: 4 },
          { at: '12:01', b: 5 },
          { at: '12:02', a: '3', b: 6 }
        ],
        'at',
        [
          { field: 'a', label: 'worker-1' },
          { field: 'b', label: 'worker-2' }
        ]
      )
    ).toEqual({
      labels: ['12:00', '12:01', '12:02'],
      titles: ['12:00', '12:01', '12:02'],
      lines: [
        { label: 'worker-1', values: [1, undefined, 3] },
        { label: 'worker-2', values: [4, 5, 6] }
      ]
    });
  });

  it('breaks a line where a value is missing', () => {
    expect(chartSegments([1, 2, undefined, 4]).map(segment => segment.map(point => point.index))).toEqual([
      [0, 1],
      [3]
    ]);
  });

  it('writes only the labels that have room, and none left empty', () => {
    expect(axisLabelIndexes(['a', 'b', 'c', 'd', 'e'], 20, 40)).toEqual([0, 2, 4]);
    expect(axisLabelIndexes(['a', '', 'c'], 100)).toEqual([0, 2]);
    // Round times every ten rows of 7px: each is 70px from the last, so every one is written.
    expect(
      axisLabelIndexes(
        Array.from({ length: 31 }, (_, index) => (index % 10 === 4 ? 'x' : '')),
        7
      )
    ).toEqual([4, 14, 24]);
  });

  it('sums a series up as its last value and its highest', () => {
    expect(lineSummary([2, 9, undefined, 4, undefined])).toEqual({ last: 4, max: 9 });
    expect(lineSummary([undefined])).toEqual({});
  });
});

describe('the series a chart is given', () => {
  it('reads records as bound and `field:label` as written, leaving out what names no field', () => {
    expect(chartSeriesOf([{ field: 'cpu', label: 'CPU' }, { label: 'none' }, { field: 'mem' }])).toEqual([
      { field: 'cpu', label: 'CPU' },
      { field: 'mem', label: 'mem' }
    ]);
    expect(chartSeriesOf('cpu:CPU, mem , :x')).toEqual([
      { field: 'cpu', label: 'CPU' },
      { field: 'mem', label: 'mem' }
    ]);
  });
});

describe('a chart whose axis says less than its readout', () => {
  it('titles each row by its own field, the axis writing only what it is given', () => {
    const table = chartTable(
      [
        { tick: '12:00', at: '12:00', a: 1 },
        { tick: '', at: '12:01', a: 2 }
      ],
      'tick',
      [{ field: 'a', label: 'a' }],
      'at'
    );

    expect([table.labels, table.titles]).toEqual([
      ['12:00', ''],
      ['12:00', '12:01']
    ]);
  });
});
