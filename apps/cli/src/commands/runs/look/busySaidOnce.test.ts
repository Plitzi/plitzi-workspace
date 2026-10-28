import { describe, expect, it } from 'vitest';

import { busySaidOnce } from './runLook';

const busy = (ms: number) =>
  `  · its main thread busy in 3 long tasks as it loaded, the longest ${String(ms)} ms (400 ms in all) — a visitor waits that long for a press to answer; a development build runs longer`;

// A run's look carried the busy line on 30 of its 34 views: on nearly every page of a development build, it told
// one page from another by nothing.
describe('a look’s busy pages', () => {
  it('are said once, with how many and the longest task', () => {
    const check = [
      '✓ /rooms at 1440 px — nothing wrong',
      busy(185),
      '✓ /r/x at 1440 px — nothing wrong',
      busy(212),
      '✓ /sign-in at 1440 px — nothing wrong'
    ].join('\n');

    expect(busySaidOnce(check).split('\n')).toEqual([
      '✓ /rooms at 1440 px — nothing wrong',
      '✓ /r/x at 1440 px — nothing wrong',
      '✓ /sign-in at 1440 px — nothing wrong',
      '  · its main thread busy as 2 of 3 views loaded, the longest task 212 ms — a development build runs longer: plitzi page check <page> says each'
    ]);
    expect(busySaidOnce(['✓ /rooms', busy(185)].join('\n'))).toBe(['✓ /rooms', busy(185)].join('\n'));
  });
});
