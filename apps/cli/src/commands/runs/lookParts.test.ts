import { createServer } from 'node:http';

import { describe, expect, it } from 'vitest';

import { comparedOf, newSinceBefore, partsComparedOf, readablePictures, redirectedPaths } from './lookParts';

// A look at a section the task added — the run before has none — took no picture at all.
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
  // A phone's whole page, 390 × 8052, read in a viewer at 97 px wide — its parts are what is read.
  it('are a tall page’s parts when the shot cut it into them, else the picture', () => {
    expect(
      readablePictures(JSON.stringify({ out: 'home.png', tiles: ['home-part-1.png', 'home-part-2.png'] }), 'home.png')
    ).toEqual(['home-part-1.png', 'home-part-2.png']);
    expect(readablePictures(JSON.stringify({ out: 'home.png' }), 'home.png')).toEqual(['home.png']);
    expect(readablePictures('not json', 'home.png')).toEqual(['home.png']);
  });
});

describe('the dress a comparison says changed', () => {
  // One gradient listed again and again, section by section and within one — a wall of text for one change.
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

// /settings and /messages send a guest to the sign-in from their own flows, declaring no access: a run's designers
// looked at them as guests five times, and pictured the sign-in.
describe('the pages a guest is sent away from', () => {
  it('are read off a page check, each once, whatever its width', () => {
    const report = (path: string, codes: string[], width = 1440) => ({
      path,
      width,
      ok: codes.length === 0,
      issues: codes.map(code => ({ code, message: '', width }))
    });
    const output = [
      'Served on :61354',
      JSON.stringify([
        report('/settings', ['redirected']),
        report('/settings', ['redirected'], 390),
        report('/charts', []),
        report('/messages/nova', ['label-wraps', 'redirected'])
      ])
    ].join('\n');
    expect(redirectedPaths(output)).toEqual(['/settings', '/messages/nova']);
    expect(redirectedPaths('not json')).toEqual([]);
  });
});

// Set beside the run before, a run's new /messages was compared with the 404 page: '16% differs', the 404's dress listed.
describe('the pages a task adds', () => {
  it('are the routes the run before answers 404, pictured alone', async () => {
    const before = createServer((request, response) => {
      response.statusCode = request.url === '/' || request.url === '/charts' ? 200 : 404;
      response.end();
    });
    await new Promise<void>(resolve => before.listen(0, '127.0.0.1', resolve));
    const address = before.address();
    const url = `http://127.0.0.1:${String(typeof address === 'object' && address ? address.port : 0)}`;
    try {
      expect([...(await newSinceBefore(url, ['/', '/messages', '/charts', '/messages/nova']))]).toEqual([
        '/messages',
        '/messages/nova'
      ]);
    } finally {
      before.close();
    }
  });
});
