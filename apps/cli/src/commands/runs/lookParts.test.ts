import { describe, expect, it } from 'vitest';

import { comparedOf, partsComparedOf, readablePictures } from './lookParts';

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

describe('the pictures a look lists', () => {
  // encore-4: a phone's whole page, 390 × 8052, read in a viewer at 97 px wide — its parts are what is read.
  it('are a tall page’s parts when the shot cut it into them, else the picture', () => {
    expect(
      readablePictures(JSON.stringify({ out: 'home.png', tiles: ['home-part-1.png', 'home-part-2.png'] }), 'home.png')
    ).toEqual(['home-part-1.png', 'home-part-2.png']);
    expect(readablePictures(JSON.stringify({ out: 'home.png' }), 'home.png')).toEqual(['home.png']);
    expect(readablePictures('not json', 'home.png')).toEqual(['home.png']);
  });
});

describe('the dress a comparison says changed', () => {
  // encore-4: one gradient listed again and again, section by section and within one — a wall of text for one change.
  it('says a change once, with every section it is in, and an item repeated in one as ×n', () => {
    const glow = 'radial-gradient(rgb(42, 31, 22)) across the section';
    const output = JSON.stringify({
      compare: {
        changed: 30,
        regions: [],
        decorations: [
          { section: 'moderation-open', extra: [glow, glow] },
          { section: 'moderation-closed', extra: [glow, glow] },
          { section: 'moderation-head', absent: ['a hairline'] }
        ]
      }
    });

    expect(comparedOf(output).dress).toEqual([
      `moderation-open, moderation-closed + ${glow} ×2`,
      'moderation-head − a hairline'
    ]);
  });
});
