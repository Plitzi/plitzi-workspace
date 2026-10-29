import { stripVTControlCharacters } from 'node:util';

import { describe, expect, it } from 'vitest';

import { lookText, lookTextWithin, picturesText, unpicturedText } from './lookText';

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
    // Steps that never played pictured nothing, and a run's look still said "nothing differs" beside the run before.
    expect(stripVTControlCharacters(lookText(looked))).toContain(
      'Beside the run before it: nothing could be compared — no view of it was pictured (below says why)'
    );
    // A run's designer looked at its parts beside the run before it and read nothing — "nothing else moved" from silence.
    expect(stripVTControlCharacters(lookText({ ...looked, unpictured: undefined, besideNothing: true }))).toContain(
      'Beside the run before it: nothing differs, and nothing else of its pages moved'
    );
    // Its parts at 3 pages, 2 widths and 2 schemes: a line each among the pictures, read as silence by a run's lead.
    const view = (route: string, changed: number, sections: string[]) => ({
      route,
      width: '1440',
      scheme: 'light',
      changed,
      sections,
      dress: []
    });
    const twelve = Array.from({ length: 12 }, (_, index) => view(`/p${String(index % 3)}`, 0, []));
    const said = stripVTControlCharacters(lookText({ ...looked, compared: twelve }));
    expect(said).toContain(
      'Beside the run before it: nothing differs — 12 views compared, and nothing else of its pages moved'
    );
    expect(said.indexOf('nothing differs')).toBeLessThan(said.indexOf('No picture could be taken'));
    expect(
      stripVTControlCharacters(lookText({ ...looked, compared: [...twelve, view('/menu', 3, ['nav 3%'])] }))
    ).toContain('Beside the run before it: 1 of 13 views compared differ (/menu) — below');
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

// A look of eight pages listed sixteen whole paths and every section a comparison found: 19k characters.
describe('a look of many pages', () => {
  it('says each folder of its pictures once, and a few of a comparison’s sections and dress', () => {
    const shots = '/p/tmp/plitzi-runs/r1/shots';
    expect(
      picturesText([
        `${shots}/t-design-home-1440-light.png`,
        `${shots}/t-design-home-390-dark.png`,
        '/p/tmp/tile-1.png'
      ])
    ).toEqual([
      '  in /p/tmp/plitzi-runs/r1/shots/',
      '    t-design-home-1440-light.png',
      '    t-design-home-390-dark.png',
      '  in /p/tmp/',
      '    tile-1.png'
    ]);

    const looked = {
      task: 't-design',
      url: 'http://127.0.0.1:50000',
      ok: true,
      check: '',
      shots: [`${shots}/t-design-home-1440-light.png`],
      timezone: 'UTC',
      compared: [
        {
          route: '/',
          width: '1440',
          scheme: 'light',
          changed: 12,
          sections: ['hero', 'charts', 'legend', 'footer', 'nav', 'cards'],
          dress: ['gradient', 'shadow']
        }
      ]
    } as unknown as Looked;
    const text = stripVTControlCharacters(lookText(looked));
    expect(text).toContain(
      '  / at 1440 light: 12% differs — hero, charts, legend, footer, and 2 more · its dress: gradient · shadow'
    );
    expect(text).toContain('    t-design-home-1440-light.png');
  });
});

// The CLI's sanity run: a show's start a minute apart on the two servers read as the page having moved.
describe('a look whose page says other words outside its parts', () => {
  it('says it is more likely the data than the task, apart from an element that moved', () => {
    const looked = {
      task: 't-how-title',
      url: 'http://127.0.0.1:50000',
      ok: true,
      check: '✓ / at 1440 px',
      shots: [],
      timezone: 'UTC',
      movedElsewhere: [
        {
          route: '/',
          element: 'time',
          changed: [{ field: 'words', here: 'Today 02:52 UTC', there: 'Today 02:53 UTC' }],
          wordsOnly: true
        },
        { route: '/rooms', element: 'a', changed: [{ field: 'box', here: '0,0,10x10', there: '0,0,12x10' }] }
      ]
    } as unknown as Looked;
    const text = stripVTControlCharacters(lookText(looked));

    expect(text).toContain('/ says other words outside its parts');
    expect(text).toContain("More likely what the two servers' data says");
    expect(text).toContain('/rooms moved outside its parts too');
    // Said by the element and what of it differs — never two lines of twenty fields.
    expect(text).toContain('a: box 0,0,12x10 → 0,0,10x10');
  });
});

// A designer's look of fifteen pages answered 23k characters, read again on every turn after.
describe('a look past one answer', () => {
  it('keeps what a review acts on and says in a line each what it leaves out — whole while short', () => {
    const pages = Array.from({ length: 15 }, (_, index) => `/p${String(index)}`);
    const looked = {
      task: 't-header-keys',
      url: 'http://127.0.0.1:50000',
      ok: false,
      check: pages
        .flatMap(page => [
          `✓ ${page} at 1440 px — 40 elements on screen, nothing wrong`,
          '  · hidden at this width by a breakpoint, on purpose: site-burger',
          `  · lists: ${'list-of-things 3 rows, '.repeat(6)}`
        ])
        .concat(['✗ /sign-in at 390 px', '  - "site-sign-in" is cut off at the edge of the screen by 12px'])
        .join('\n'),
      shots: pages.flatMap(page => [
        `/run/shots/${page.slice(1)}-1440-light.png`,
        `/run/shots/${page.slice(1)}-390-dark.png`
      ]),
      compared: pages.map(page => ({
        route: page,
        width: '1440',
        scheme: 'light',
        changed: 0,
        sections: [],
        dress: []
      })),
      timezone: 'UTC'
    } as unknown as Looked;

    const whole = stripVTControlCharacters(lookTextWithin(looked, 100_000));
    expect(whole).toBe(stripVTControlCharacters(lookText(looked)));

    const within = stripVTControlCharacters(lookTextWithin(looked, 3000));
    expect(within.length).toBeLessThan(whole.length / 2);
    // What it acts on first — the failure — is kept whole.
    expect(within).toContain('"site-sign-in" is cut off at the edge of the screen by 12px');
    expect(within).toContain('30 lines of lists and hidden parts left out: plitzi page check <page> says them');
    expect(within).toContain('in /run/shots/');
    expect(within).toContain('(30 pictures)');
    expect(within).toContain('Nothing changed beside the run before it at 15 more');
  });
});
