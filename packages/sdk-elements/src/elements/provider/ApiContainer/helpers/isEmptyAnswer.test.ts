import { describe, expect, it } from 'vitest';

import { isEmptyAnswer } from './isEmptyAnswer';

describe('isEmptyAnswer', () => {
  it('reads a plain query answer by what it received', () => {
    expect(isEmptyAnswer({ data: { games: [{ id: 1 }] } }, [], false)).toBe(false);
    expect(isEmptyAnswer({ data: [{ id: 1 }] }, [], false)).toBe(false);
    expect(isEmptyAnswer({ data: [] }, [], false)).toBe(true);
    expect(isEmptyAnswer({ data: {} }, [], false)).toBe(true);
    expect(isEmptyAnswer({}, [], false)).toBe(true);
  });

  it('reads a connector list by its records, as paginated', () => {
    expect(isEmptyAnswer({ records: [] }, [], false)).toBe(true);
    expect(isEmptyAnswer({ records: [] }, [{ id: 1 }], false)).toBe(false);
  });

  it('reads a detail provider by its record', () => {
    expect(isEmptyAnswer({ record: { id: 1 } }, [], true)).toBe(false);
    expect(isEmptyAnswer({}, [], true)).toBe(true);
  });
});
