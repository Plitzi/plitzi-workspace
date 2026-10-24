import { describe, expect, it } from 'vitest';

import { partsComparedOf } from './lookParts';

// encore-2: a look at a section the task added — the run before has none — took no picture at all.
describe('the parts a look set beside the run before it', () => {
  it('keep a part new with the task with its own picture, said as new, beside one compared', () => {
    const output = JSON.stringify({
      parts: [
        {
          part: 'home-live',
          problem: 'new: the run before has none of it — pictured alone',
          own: 'shots/t-home-live.png'
        },
        {
          part: 'home-how',
          own: 'shots/t-home-how.png',
          compare: { changed: 12, sideBySide: 'shots/t-home-how-compare.png' }
        }
      ]
    });

    expect(partsComparedOf(output)).toEqual([
      {
        compared: {
          sections: [],
          dress: [],
          problem: 'home-live: new: the run before has none of it — pictured alone'
        },
        shot: 'shots/t-home-live.png'
      },
      {
        compared: { changed: 12, sections: ['home-how 12%'], dress: [], sideBySide: 'shots/t-home-how-compare.png' },
        shot: 'shots/t-home-how.png'
      }
    ]);
  });
});
