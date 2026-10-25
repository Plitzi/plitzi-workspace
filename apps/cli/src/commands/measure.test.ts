import { stripVTControlCharacters } from 'node:util';

import { describe, expect, it } from 'vitest';

import { measureOn, onlyProperties, pairOf, readingKey, sameProperties } from './measure';
import { putIn, rowsOf, stateText } from './measureState';
import { comparedText, measuredText, readingText } from './measureText';
import { differences, MEASURED, PSEUDO_MEASURED } from './measureValues';

import type { Measured } from './measureValues';

const measured = (styles: Record<string, string>, text = 'VS'): Measured => ({
  selector: '[data-plitzi-el="vs"]',
  tag: 'span',
  text,
  styles: Object.fromEntries(MEASURED.map(property => [property, styles[property] ?? 'normal'])),
  inherited: []
});

// velada-polish's designers read the original's CSS by curl, and measured with scripts of their own, for each value.
describe('page measure', () => {
  it('says what differs, by property, here → there — and the rest the same, what each is compared on said above', () => {
    const here = measured({ 'font-size': '37.6px', 'border-top': '2px solid rgb(199, 168, 107)' });
    const there = measured({ 'font-size': '44px', 'border-top': '1px solid rgb(199, 168, 107)' });

    expect(differences(here, there).differ).toEqual([
      { property: 'font-size', here: '37.6px', there: '44px' },
      { property: 'border-top', here: '2px solid rgb(199, 168, 107)', there: '1px solid rgb(199, 168, 107)' }
    ]);
    const text = stripVTControlCharacters(measuredText(here, there));
    expect(text).toContain('span "VS" ([data-plitzi-el="vs"]) here → span "VS" ([data-plitzi-el="vs"]) there');
    expect(text).toMatch(/≠ font-size\s+37\.6px {2}→ {2}44px/);
    expect(text).toContain('the rest the same');
    expect(text).not.toContain('font-family');
    expect(stripVTControlCharacters(comparedText('https://www.example.com/combates'))).toMatch(
      /^Beside https:\/\/www\.example\.com\/combates \(there\) — each compared on font-family, .*, and the ::before\/::after either page has \(content, .*\): below, what differs$/
    );
  });

  // lx-product: a reading of six pairs said the other page's address, its 25 properties and when it was kept six times —
  // half of what it printed, read again by the agent on every turn after.
  it('says per pair only what is its own: a pseudo-element compared, a side asked alone, nothing when all is the same', () => {
    const plain = measured({});
    const drawn = {
      ...measured({}),
      styles: { ...measured({}).styles, 'after:content': '""', 'after:width': '350px' }
    };
    const wider = { ...drawn, styles: { ...drawn.styles, 'font-size': '12px' } };

    expect(stripVTControlCharacters(measuredText(drawn, wider))).toContain('the rest the same (its ::after too)');
    expect(stripVTControlCharacters(measuredText(plain, plain))).not.toMatch(/the rest|the same:/);
    const reading = {
      width: 1440,
      pair: pairOf('vs => .vs'),
      here: plain,
      there: plain,
      keptAt: new Date(0).toISOString(),
      unlike: []
    };
    expect(stripVTControlCharacters(readingText(reading, undefined, 0, true))).not.toContain('kept');
    expect(stripVTControlCharacters(readingText(reading, undefined, 0))).toContain('(there: read 0 min ago and kept');
  });

  it('says an element that is not on the page, by the page it looked in', async () => {
    // A stand-in of a page: only its address and how many elements a selector finds are read before it is said missing.
    const page = {
      url: () => 'http://127.0.0.1:8080/combates',
      locator: () => ({ first: () => ({ count: () => Promise.resolve(0) }) })
    } as unknown as Parameters<typeof measureOn>[0];

    expect(await measureOn(page, 'vs-medal')).toEqual({
      problem: expect.stringContaining('No element vs-medal on http://127.0.0.1:8080/combates — name it by') as unknown
    });
  });

  // velada-backlog: the medal's fill fades in on its card's hover — measured by hand, with a script of design-1's own.
  it('puts a page in the state asked before measuring — hovered or focused, its transitions waited for — or says why not', async () => {
    const acts: string[] = [];
    const stand = (count: number, act: () => Promise<void>) => {
      const element = {
        count: () => Promise.resolve(count),
        hover: () => act().then(() => acts.push('hover')),
        focus: () => act().then(() => acts.push('focus')),
        click: () => act().then(() => acts.push('click'))
      };

      // A stand-in of a page: what putIn reads of one — its address, the element found, the state put, the wait.
      return {
        url: () => 'http://127.0.0.1:8080/combates',
        locator: () => ({ first: () => element, filter: () => ({ first: () => element }) }),
        evaluate: () => Promise.resolve(acts.push('settled')),
        keyboard: { press: (key: string) => Promise.resolve(acts.push(`press ${key}`)) },
        waitForTimeout: () => Promise.resolve(),
        // What a click asks the server is followed by its requests: none here.
        on: () => undefined,
        off: () => undefined
      } as unknown as Parameters<typeof putIn>[0];
    };
    const state = { kind: 'hover' as const, pairs: [pairOf('fight-card => .fight-card')] };

    expect(
      await putIn(
        stand(1, () => Promise.resolve()),
        state,
        'here'
      )
    ).toBeUndefined();
    expect(acts).toEqual(['hover', 'settled']);
    expect(
      await putIn(
        stand(0, () => Promise.resolve()),
        state,
        'here'
      )
    ).toEqual({
      problem: 'No element fight-card to hover on http://127.0.0.1:8080/combates'
    });
    expect(
      await putIn(
        stand(1, () => Promise.reject(new Error('Timeout 5000ms exceeded.\n  waiting for…'))),
        { ...state, kind: 'focus' },
        'there'
      )
    ).toEqual({
      problem: '.fight-card could not be focused on http://127.0.0.1:8080/combates: Timeout 5000ms exceeded.'
    });

    // lx-controls: an open state — a drawer, then a panel in it — clicked in turn on each page, each settled.
    acts.length = 0;
    const opened = { kind: 'click' as const, pairs: [pairOf('toggle => .open'), pairOf('row => summary')] };
    expect(
      await putIn(
        stand(1, () => Promise.resolve()),
        opened,
        'there'
      )
    ).toBeUndefined();
    expect(acts).toEqual(['click', 'settled', 'click', 'settled']);
    expect(stateText(opened, 'there')).toBe('.open, then summary clicked');

    // encore-2: a focus ring is drawn on `:focus-visible` — a keyboard's focus: a key pressed, then the element focused.
    acts.length = 0;
    expect(
      await putIn(
        stand(1, () => Promise.resolve()),
        { ...state, kind: 'focus' },
        'here'
      )
    ).toBeUndefined();
    expect(acts).toEqual(['press Shift', 'focus', 'settled']);

    // encore-2: a menu opened, then an item of it hovered — the clicks first, the hover last, each settled.
    acts.length = 0;
    const menuItem = {
      kind: 'click' as const,
      pairs: [pairOf('site-avatar')],
      then: { kind: 'hover' as const, pair: pairOf('site-menu-item') }
    };
    expect(
      await putIn(
        stand(1, () => Promise.resolve()),
        menuItem,
        'here'
      )
    ).toBeUndefined();
    expect(acts).toEqual(['click', 'settled', 'hover', 'settled']);
    expect(stateText(menuItem, 'here')).toBe('site-avatar clicked, then site-menu-item hovered');
  });

  // velada-backlog: design-1 measured `.home-faq-answer-text` — the element's id, written as a class — and was told
  // only "No element".
  it('says the other way to write a name the page has that way: an id without its dot, a class with one', async () => {
    const having = (...present: string[]) =>
      // A stand-in of a page: its address, and how many elements each selector finds.
      ({
        url: () => 'http://127.0.0.1:8080/',
        locator: (selector: string) => ({
          first: () => ({ count: () => Promise.resolve(present.includes(selector) ? 1 : 0) })
        })
      }) as unknown as Parameters<typeof measureOn>[0];

    expect(await measureOn(having('[data-plitzi-el="home-faq-answer-text"]'), '.home-faq-answer-text')).toEqual({
      problem:
        "No element .home-faq-answer-text on http://127.0.0.1:8080/ — home-faq-answer-text is an element's id here: write it without the dot"
    });
    expect(await measureOn(having('.faq-answer-body'), 'faq-answer-body')).toEqual({
      problem:
        "No element faq-answer-body on http://127.0.0.1:8080/ — faq-answer-body is a class here, no element's id: write it .faq-answer-body"
    });
  });

  // velada-backlog: `body` on our side read Times 400 and the noscript's words — the space's type is on its root.
  it("says, of a document's body measured on a space's page, the root to measure instead", () => {
    const body = { ...measured({}, ''), tag: 'body', selector: 'body', spaceRoot: 'shell-root' };

    expect(stripVTControlCharacters(measuredText(body, measured({}, '')))).toContain(
      'body is the document\'s: the space dresses its root, shell-root — measure it, "shell-root => body"'
    );
  });

  // Preparing velada's next run: our footer's label, held still, read "color 1e-05s cubic-bezier(0.4, 0, 0.2, 1)" against
  // the original's 0.3s — a difference of nothing, said because the easing's own commas split the list.
  it('reads a transition held still as no difference, whatever commas its easing has', () => {
    const here = measured({ transition: 'color 1e-05s cubic-bezier(0.4, 0, 0.2, 1), opacity 0s ease' });
    const there = measured({ transition: 'color 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.5s ease' });
    const moving = measured({ transition: 'color 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0s ease' });

    expect(differences(here, there).differ.map(each => each.property)).not.toContain('transition');
    expect(
      differences(moving, measured({ transition: 'color 0.6s ease' })).differ.map(each => each.property)
    ).toContain('transition');
  });

  // velada-shell: the brief said "16px → 22.13px", and dev-1 tried three values before line-height 1.5.
  it('says a line height and a tracking as a share of the font beside their pixels', () => {
    const here = measured({ 'font-size': '14.75px', 'line-height': '16px', 'letter-spacing': '2.36px' });
    const there = measured({ 'font-size': '14.75px', 'line-height': '22.125px', 'letter-spacing': '2.36px' });

    expect(stripVTControlCharacters(measuredText(here, there))).toMatch(
      /≠ line-height\s+16px \(1\.085em\) {2}→ {2}22\.125px \(1\.5em\)/
    );
  });

  // velada-shell's design-1: a proof line failed on a font-size both inherit, which the task never touched.
  it('leaves what both inherit out of --same, said beside the line rather than failing it', () => {
    const inherited = { property: 'font-size', here: '14px', there: '16px', inherited: true as const };
    const text = stripVTControlCharacters(
      readingText(
        {
          width: 1440,
          pair: pairOf('site-socials => footer nav'),
          here: measured({}),
          there: measured({}),
          unlike: [],
          inherited: [inherited]
        },
        ['gap', 'font-size'],
        Date.now()
      )
    );

    expect(text).toContain('✓ --same: gap, font-size');
    expect(text).toContain('left out of --same, inherited from its parent on both pages: font-size 14px → 16px');
  });

  // velada-polish: the VS sizes in the acceptance were the lead's guess; a line that measures them proves them.
  it('takes the properties an acceptance holds to the other page, shorthands opened, and refuses what is not measured', () => {
    expect(sameProperties('font-size, border')).toEqual([
      'font-size',
      'border-top',
      'border-right',
      'border-bottom',
      'border-left'
    ]);
    expect(sameProperties('font')).toContain('letter-spacing');
    expect(() => sameProperties('font-size,glow')).toThrow('not glow');
  });

  // encore-3: a fit asked for an element's box, and its 30 properties were grepped for it.
  it('prints only what is asked, its box a word — and refuses what is not measured, naming the flag', () => {
    expect(onlyProperties('box')).toEqual(['x', 'y', 'width', 'height', 'padding', 'margin']);
    expect(onlyProperties('box,font-size')).toContain('font-size');
    expect(() => onlyProperties('glow')).toThrow('--only takes what is measured');
  });

  // encore-3: a list's three plates were measured by their first alone, and their readouts differed (235/303/241 px).
  it('measures each row a list draws of an element, and one drawn once as itself', async () => {
    const drawn = (rows: number) =>
      ({
        locator: (selector: string) => ({
          first: () => ({
            count: () => {
              const nth = /nth=(\d+)$/.exec(selector);

              return Promise.resolve(nth ? Number(Number(nth[1]) < rows) : rows > 0 ? 1 : 0);
            }
          })
        })
      }) as unknown as Parameters<typeof rowsOf>[0];
    const pair = { here: '.show-plate', there: '.show-plate' };

    expect((await rowsOf(drawn(3), pair)).map(each => each.here)).toEqual([
      '.show-plate >> nth=0',
      '.show-plate >> nth=1',
      '.show-plate >> nth=2'
    ]);
    expect(await rowsOf(drawn(1), pair)).toEqual([pair]);
  });

  // velada's first measures: Cinzel with another fallback, borders of no width, one gold in two notations — noise.
  it('reads one look written two ways as the same: the font asked first, a side of no width, one colour', () => {
    const here = measured({
      'font-family': 'Cinzel, Georgia, serif',
      color: 'rgb(199, 168, 107)',
      'border-top': '0px solid rgb(244, 228, 201)',
      'font-size': '9.808px'
    });
    const there = measured({
      'font-family': '"Cinzel", "Cinzel Fallback", system-ui',
      color: 'color(srgb 0.780392 0.658824 0.419608)',
      'border-top': '0px solid color(srgb 0.8 0.69 0.47 / 0.88)',
      'font-size': '14.7536px'
    });

    expect(differences(here, there).differ.map(each => each.property)).toEqual(['font-size']);

    // Tailwind's oklab gold is the theme's gold.
    const tailwind = measured({
      'font-family': 'Cinzel',
      'background-color': 'oklab(0.745428 0.00989413 0.0865543 / 0.05)'
    });
    const ours = measured({
      'font-family': 'Cinzel',
      'background-color': 'color(srgb 0.780392 0.658824 0.419608 / 0.05)'
    });
    expect(differences(ours, tailwind).differ).toEqual([]);
  });

  // velada-fidelity: ~150 calls, one element a call — each ours and theirs, written in one argument.
  it('reads "ours => theirs" as one element asked on both pages, and a name alone as the same on both', () => {
    expect(pairOf('fight-card-vs => .vs-medal')).toEqual({ here: 'fight-card-vs', there: '.vs-medal' });
    expect(pairOf('[data-plitzi-el="a"] > span=>.b span')).toEqual({
      here: '[data-plitzi-el="a"] > span',
      there: '.b span'
    });
    expect(pairOf('fight-card-vs')).toEqual({ here: 'fight-card-vs', there: 'fight-card-vs' });
  });

  // velada-fidelity: the VS medal's fill is on ::before — read as no fill, and the plan asked it away.
  it('compares what a box draws on ::before, and holds --same to it', () => {
    const here = { ...measured({}), styles: { ...measured({}).styles } };
    const there = {
      ...measured({}),
      styles: {
        ...measured({}).styles,
        'before:background-image': 'radial-gradient(circle, gold, black)',
        'before:opacity': '0.6'
      }
    };

    expect(differences(here, there).differ).toEqual(
      expect.arrayContaining([
        { property: 'before:background-image', here: 'none', there: 'radial-gradient(circle, gold, black)' },
        { property: 'before:opacity', here: 'none', there: '0.6' }
      ])
    );
    expect(sameProperties('before:background-image,after:opacity')).toEqual([
      'before:background-image',
      'after:opacity'
    ]);
    expect(() => sameProperties('before:glow')).toThrow('not before:glow');
  });

  // velada-fidelity: every element listed the page's font as differing, burying what the element itself does.
  it('says what both inherit from their parent apart, once, after what the element itself does differently', () => {
    const here = { ...measured({ 'font-family': 'system-ui', 'font-size': '12px' }), inherited: ['font-family'] };
    const there = { ...measured({ 'font-family': 'Cinzel', 'font-size': '14px' }), inherited: ['font-family'] };

    expect(differences(here, there).differ).toEqual([
      { property: 'font-family', here: 'system-ui', there: 'Cinzel', inherited: true },
      { property: 'font-size', here: '12px', there: '14px' }
    ]);
    const text = stripVTControlCharacters(measuredText(here, there));
    expect(text).toMatch(/≠ font-size/);
    expect(text).not.toMatch(/≠ font-family/);
    expect(text).toContain('≈ inherited from its parent on both pages, differs: font-family system-ui → cinzel');
  });
});

// lx-fidelity: a height 0.13px off failed an acceptance line, an agent tuned a margin to 63.93px to pass one, `--same
// margin-bottom` was refused, and every agent read positions with a browser script of its own.
describe('page measure, held to the pixel', () => {
  it('takes lengths within half a pixel as the same, and one a pixel off as different', () => {
    const tall = (height: string, margin = '0px') => measured({ height, margin });

    expect(differences(tall('404.984px'), tall('404.859px')).differ).toEqual([]);
    expect(differences(tall('1005.03px'), tall('1004.95px')).differ).toEqual([]);
    expect(differences(tall('405px'), tall('406px')).differ.map(each => each.property)).toEqual(['height']);
  });

  // lx-product: the original's bullets were `list-style-position: inside`, which no reading showed, and an arrow's place
  // down a column could be neither measured nor held (`--same y` refused).
  // lx-product: a reading of the original kept before `list-style` and `y` were measured answered "none" for both — two
  // differences that were not there, until it was read again.
  it('keeps a reading of the other page by what it measures: one measured with fewer properties is read again', () => {
    const key = JSON.parse(readingKey({ url: 'https://www.example.com/', target: '.hero' })) as unknown;

    expect(key).toMatchObject({
      url: 'https://www.example.com/',
      measured: [...MEASURED],
      pseudo: [...PSEUDO_MEASURED]
    });
  });

  it('reads and holds a list’s marker and where a box starts down the page', () => {
    expect(sameProperties('list-style,y')).toEqual(['list-style', 'y']);
    const item = (listStyle: string, y: string) => measured({ 'list-style': listStyle, y });

    expect(differences(item('inside none disc', '625px'), item('inside none disc', '624.6px')).differ).toEqual([]);
    expect(
      differences(item('outside none disc', '625px'), item('inside none disc', '660px')).differ.map(
        each => each.property
      )
    ).toEqual(['list-style', 'y']);
  });

  // lx-product: a 1588px section of eighteen list items came 1.06px off, each line's rounding added up.
  it('holds a box’s size within a thousandth of it, its spacing within half a pixel', () => {
    const box = (height: string, margin = '0px') => measured({ height, margin });

    expect(differences(box('1589.56px'), box('1588.5px')).differ).toEqual([]);
    expect(differences(box('1592px'), box('1588.5px')).differ.map(each => each.property)).toEqual(['height']);
    expect(differences(box('40px', '33px'), box('40px', '32px')).differ.map(each => each.property)).toEqual(['margin']);
  });

  it('holds a side of a margin or a padding alone, read off its shorthand', () => {
    expect(sameProperties('margin-bottom,padding-top')).toEqual(['margin-bottom', 'padding-top']);
    const here = measured({ margin: '0px 0px 24px', padding: '10px 20px' });
    const there = measured({ margin: '8px 0px 24px', padding: '10px 20px 12px' });

    expect(differences(here, there, ['margin-bottom', 'padding-top', 'padding-bottom']).differ).toEqual(
      expect.arrayContaining([{ property: 'padding-bottom', here: '10px', there: '12px' }])
    );
    expect(
      differences(here, there, ['margin-bottom']).differ.filter(each => each.property === 'margin-bottom')
    ).toEqual([]);
  });

  it('measures where a box starts, x, as a property --same takes', () => {
    expect(MEASURED).toContain('x');
    expect(sameProperties('x')).toEqual(['x']);
    expect(differences(measured({ x: '50px' }), measured({ x: '290px' })).differ).toEqual([
      { property: 'x', here: '50px', there: '290px' }
    ]);
  });
});
