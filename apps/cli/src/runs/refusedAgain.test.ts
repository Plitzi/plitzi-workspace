import { describe, expect, it } from 'vitest';

import { refusedAgain } from './refusedAgain';

const at = (minute: number): string => new Date(Date.UTC(2026, 9, 21, 20, minute)).toISOString();

const refused = (minute: number, code: string, message: string) => ({
  at: at(minute),
  by: 'dev-1',
  action: 'refused',
  code,
  message
});

// velada-dress: dev-1 refused four times in twenty minutes on t-heading, and nobody knew until the run was over.
describe('a task refused again and again', () => {
  it('wakes the lead once it is refused three times within twenty minutes — not for older ones', () => {
    const log = [
      refused(0, 'claimed', 'Task "t-heading" changed files another task at work holds: src/space/shell/sponsors.ts'),
      refused(10, 'claimed', 'Task "t-heading" changed files another task at work holds: src/space/shell/sponsors.ts'),
      refused(19, 'invalid', 'Task "t-heading" is waiting: only a task in progress completes'),
      refused(19, 'checks-failed', 'Task "t-menu"\'s acceptance is not met')
    ];

    expect(refusedAgain(log, new Date(at(20)))).toEqual([
      expect.objectContaining({
        kind: 'refused-again',
        task: 't-heading',
        text: expect.stringContaining('dev-1 was refused 3 times in 20 min on t-heading (claimed, invalid)') as unknown
      })
    ]);
    expect(refusedAgain(log, new Date(at(35)))).toEqual([]);
  });
});
