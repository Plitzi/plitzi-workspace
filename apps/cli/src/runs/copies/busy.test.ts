import { describe, expect, it } from 'vitest';

import { busyTimeoutsNote } from './busy';

const timedOut = [
  '  1) visual/monitor.spec.ts:88 › the phone sheet › drags up',
  '    Test timeout of 30000ms exceeded.'
];
const wrong = ['  Expected: "half"', '  Received: "rest"'];

// A run's finish refused twice on drag specs timing out at a load of 35–50; they passed alone right after.
describe('lines that failed only by running out of time on a busy machine', () => {
  it('are said as such when every failure timed out and the machine was busy', () => {
    expect(busyTimeoutsNote([timedOut, timedOut], { load: 42, cores: 10 })).toBe(
      'Every line that failed timed out while this machine was busy (load 42 on 10 cores): nothing says the result is broken — finish again once it is quieter, or run those lines alone to see'
    );
  });

  it('are not when one failed otherwise, or the machine was quiet', () => {
    expect(busyTimeoutsNote([timedOut, wrong], { load: 42, cores: 10 })).toBeUndefined();
    expect(busyTimeoutsNote([timedOut], { load: 6, cores: 10 })).toBeUndefined();
    expect(busyTimeoutsNote([], { load: 42, cores: 10 })).toBeUndefined();
  });
});
