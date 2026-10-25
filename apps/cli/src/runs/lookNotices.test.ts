import { describe, expect, it } from 'vitest';

import { sharedLookNotices } from './lookNotices';
import { benchPlan } from '../tests/runProject';

const dressed = (clip: string, look: string) => ({
  said: `/ wears the original's ${look}`,
  check: `plitzi page shot / --url $PLITZI_URL --compare https://example.com/ --clip ${clip} --dress "${look}"`
});

// The sponsors section's glow was t-heading's, its banners t-sponsors' — one waited fifty minutes on the other.
describe('one section dressed by two tasks', () => {
  it('says the tasks that both prove the dress of a section, and none that prove their own', () => {
    const plan = benchPlan();
    plan.tasks[0].acceptance = [dressed('site-sponsors', 'radial-gradient across')];
    plan.tasks[1].acceptance = [dressed('site-sponsors', 'box-shadow'), dressed('menu-page', 'text-shadow')];
    plan.tasks[2].acceptance = [dressed('book-page', 'box-shadow')];

    expect(sharedLookNotices(plan.tasks)).toEqual([
      expect.stringContaining('t-home and t-menu both prove the dress of / #site-sponsors') as unknown
    ]);
  });
});
