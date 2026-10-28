import { describe, expect, it } from 'vitest';

import { busyOf } from './busy';

// A lead wrote a probe of its own to learn whether a room's page held its main thread: page check said nothing of it.
describe('a page’s main thread as it loaded', () => {
  it('says its long tasks past a quarter of a second in all — and nothing below, nor where none were kept', () => {
    expect(busyOf([120, 90, 150])).toEqual({ tasks: 3, longest: 150, total: 360 });
    expect(busyOf([60, 80])).toBeUndefined();
    expect(busyOf(undefined)).toBeUndefined();
    expect(busyOf(['x', 300])).toEqual({ tasks: 1, longest: 300, total: 300 });
  });
});
