import { stripVTControlCharacters } from 'node:util';

import { describe, expect, it } from 'vitest';

import { lookText, unpicturedText } from './lookText';

type Looked = Parameters<typeof lookText>[0];

// "No picture could be taken" alone left four reviewers to page through it themselves.
describe('a look that took no picture', () => {
  it('says why each was not taken', () => {
    // The few fields a look's text reads when nothing was pictured; the rest of a look is none of this test's.
    const looked = {
      task: 't-request-form',
      url: 'http://127.0.0.1:50000',
      ok: true,
      check: '✓ /r/night-drive at 1440 px',
      shots: [],
      unpictured: [
        {
          what: '/r/night-drive room-request at 1440 light, beside the run before',
          why: 'room-request is not on the page'
        }
      ],
      timezone: 'UTC'
    } as unknown as Looked;
    const text = stripVTControlCharacters(lookText(looked));

    expect(text).toContain('No picture could be taken.');
    expect(text).toContain('Not pictured (1):');
    expect(text).toContain('room-request is not on the page');
    // A run's designer looked at its own task to see nothing else moved, and was not told --before does it.
    expect(text).not.toContain('Not set beside the run before it');
    expect(stripVTControlCharacters(lookText({ ...looked, notBeside: true }))).toContain(
      'Not set beside the run before it — that nothing else moved is read with it: --before'
    );
    // The song playing differed on the two sides — the copy's queue played by its agent.
    expect(stripVTControlCharacters(lookText({ ...looked, warmCopy: true }))).toContain(
      'plitzi server reset in its copy (its server stopped), then look again --fresh'
    );
  });
});

// "siteRooms is not on <url>" ten times — a part a guest has not, and no line said how to see it.
describe('pictures not taken for one reason', () => {
  it('are said once, with how to see the part', () => {
    const text = unpicturedText(
      ['/', '/rooms', '/design', '/settings'].map(route => ({
        what: `${route} at 1440 light`,
        why: `siteRooms is not on http://127.0.0.1:52937${route}.`
      }))
    ).map(line => stripVTControlCharacters(line));

    expect(text).toEqual([
      'Not pictured (4):',
      '  siteRooms is not on the page — / at 1440 light; /rooms at 1440 light; /design at 1440 light; and 1 more — on none of them: a part a guest has not (--as <username>), or one a state opens (--click <id>)'
    ]);
  });
});
