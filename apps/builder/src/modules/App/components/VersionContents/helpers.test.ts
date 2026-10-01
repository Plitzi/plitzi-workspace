import { describe, expect, it } from 'vitest';

import { contentsRows } from './helpers';

import type { SpaceVersionContents } from '@plitzi/sdk-shared';

const contents = (over: Partial<SpaceVersionContents> = {}): SpaceVersionContents => ({
  environment: 'main',
  revision: 0,
  snapshot: null,
  pages: 3,
  layouts: 1,
  elements: 120,
  plugins: [],
  actions: 18,
  connectors: 0,
  functions: { tasks: 6, routes: 1 },
  runtime: { source: true },
  ...over
});

describe('what a version holds, line by line', () => {
  it('counts each part, in words a person reads', () => {
    expect(contentsRows(contents())).toEqual([
      { label: 'Pages', value: '3 pages · 1 layout · 120 elements' },
      { label: 'Server actions', value: '18 actions' },
      { label: 'Connectors', value: 'None' },
      { label: 'Functions', value: '6 tasks · 1 route' },
      { label: 'Runtime', value: 'Its code, with the source it was packed from' }
    ]);
  });

  it('says what a version has none of, and a runtime kept built only', () => {
    const rows = contentsRows(contents({ actions: 0, functions: null, runtime: { source: false } }));

    expect(rows.find(row => row.label === 'Server actions')?.value).toBe('None');
    expect(rows.find(row => row.label === 'Functions')?.value).toBe('None');
    expect(rows.find(row => row.label === 'Runtime')?.value).toBe('Its code, built only');
  });
});
