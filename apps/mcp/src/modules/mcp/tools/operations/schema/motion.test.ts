import { describe, expect, it } from 'vitest';

import { elementMotion } from './shared';

describe('elementMotion', () => {
  it('takes the presets the SDK plays, and refuses the rest with what is wrong', () => {
    expect(elementMotion.safeParse({ enter: 'fade-up', on: 'view', delay: 120 }).success).toBe(true);
    expect(elementMotion.safeParse({ loop: 'float' }).success).toBe(true);

    const bounce = elementMotion.safeParse({ enter: 'bounce' });
    expect(bounce.success).toBe(false);
    expect(elementMotion.safeParse({}).error?.issues.map(issue => issue.message)).toEqual([
      'motion says nothing to play: give it an `enter`, a `loop`, or both'
    ]);
    expect(elementMotion.safeParse({ loop: 'pulse', stagger: 60 }).error?.issues.map(issue => issue.message)).toEqual([
      'motion.stagger staggers the children’s `enter`: give it one'
    ]);
    expect(elementMotion.safeParse({ enter: 'fade', speed: 2 }).success).toBe(false);
  });
});
