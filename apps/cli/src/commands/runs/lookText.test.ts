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

    expect(text).toContain('No picture could be taken:');
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

  // A run's look said "No picture could be taken" of / as a guest and signed in, with no reason given.
  it('says what it is when no reason was given: nothing changed to picture, or no command that said why', () => {
    const looked = {
      task: 't-home',
      url: 'http://127.0.0.1:50000',
      ok: true,
      check: '',
      shots: []
    } as unknown as Looked;

    expect(stripVTControlCharacters(lookText({ ...looked, unchanged: ['/'] }))).toContain(
      'Nothing pictured: what it looked at is drawn as the run before it draws it.'
    );
    expect(stripVTControlCharacters(lookText(looked))).toContain(
      'No picture was taken, and no picture command said why: look at one page again — plitzi task look t-home <page> --fresh'
    );
  });

  // A notice only a channel's message shows could not be looked at in review: --steps sets the state it reads.
  it('says the pictures were taken after the steps asked', () => {
    const looked = {
      task: 't-notice',
      url: 'http://127.0.0.1:50000',
      ok: true,
      check: '',
      shots: []
    } as unknown as Looked;
    expect(stripVTControlCharacters(lookText({ ...looked, steps: 'state notice {"room":"r1"}' }))).toContain(
      'Pictured after "state notice {"room":"r1"}"; the check read each page at rest'
    );
  });

  // A look read /moderation as a guest and failed it as "sent the browser to /": the task's UI never seen.
  it('says the pages for signed-in visitors, read as the project’s account or as a guest and why', () => {
    const looked = {
      task: 't-mod',
      url: 'http://127.0.0.1:50000',
      ok: true,
      check: '',
      shots: []
    } as unknown as Looked;
    expect(
      stripVTControlCharacters(lookText({ ...looked, forVisitors: { pages: ['/moderation'], as: 'ana' } }))
    ).toContain('Read signed in as ana, the project’s account: /moderation is for signed-in visitors');
    expect(stripVTControlCharacters(lookText({ ...looked, forVisitors: { pages: ['/moderation'] } }))).toContain(
      '⚠ /moderation is for signed-in visitors, read as a guest: name the project’s account in .env (PLITZI_CHECK_USER, PLITZI_CHECK_PASSWORD) — or --as <username>'
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
