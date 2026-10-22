import { describe, expect, it } from 'vitest';

import { floorOf, floorOnLine, satisfies } from './versions';

const NODE = '^24.22.1 || >=26.12.1';

// Node's October 2026 security release: each LTS line from its patch, one range — read whole, never by its first part.
describe('a range of several', () => {
  it('allows a version any of its parts allows, and none of the others', () => {
    expect(satisfies('24.22.1', NODE)).toBe(true);
    expect(satisfies('22.23.4', NODE)).toBe(false);
    expect(satisfies('26.12.1', NODE)).toBe(true);
    expect(satisfies('24.14.1', NODE)).toBe(false);
    expect(satisfies('22.18.0', NODE)).toBe(false);
    expect(satisfies('25.9.0', NODE)).toBe(false);
  });

  it('says its lowest version, and the lowest on a line', () => {
    expect(floorOf(NODE)).toEqual([24, 22, 1]);
    expect(floorOnLine(NODE, 24)).toEqual([24, 22, 1]);
    expect(floorOnLine(NODE, 25)).toBeUndefined();
  });

  it('leaves a range it does not read unknown, never false', () => {
    expect(satisfies('24.22.1', 'workspace:* || ^9.0.0')).toBe(undefined);
  });
});
