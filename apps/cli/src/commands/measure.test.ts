import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { stripVTControlCharacters } from 'node:util';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { measure, onlyProperties, pairOf, readingKey, saidOnce, sameProperties } from './measure';
import { measureOn, pseudoBoxes } from './measureOn';
import { putIn, copiesOf, stateText } from './measureState';
import { comparedText, measuredText, readingText } from './measureText';
import { differences, extraOf, MEASURED, PSEUDO_MEASURED } from './measureValues';

import type { Measured } from './measureValues';
import type { LayoutSession } from '../browser';

const measured = (styles: Record<string, string>, text = 'VS'): Measured => ({
  selector: '[data-plitzi-el="vs"]',
  tag: 'span',
  text,
  styles: Object.fromEntries(MEASURED.map(property => [property, styles[property] ?? 'normal'])),
  inherited: []
});

// A run's designers read the original's CSS by curl, and measured with scripts of their own, for each value.
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

  // A reading of six pairs said the other page's address, its 25 properties and when it was kept six times —
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
      // A host's desk measured as a guest — the ways it may not be drawn there, said.
      problem: expect.stringContaining(
        'No element vs-medal on http://127.0.0.1:8080/combates — not drawn here: a page for signed-in visitors (--as <username>)'
      ) as unknown
    });
  });

  // encore-12's scout wrote [data-plitzi-el="room-card-quiet-demo"] for a component's instance, and read data-plitzi-instance
  // only in the page's HTML.
  it('says how to name a component instance written as an element', async () => {
    const page = {
      url: () => 'http://127.0.0.1:8080/design/components',
      locator: (selector: string) => ({
        first: () => ({
          count: () =>
            Promise.resolve(
              selector === '[data-plitzi-instance="room-card-quiet-demo"] [data-plitzi-el="room-card-idle"]' ? 1 : 0
            )
        })
      })
    } as unknown as Parameters<typeof measureOn>[0];

    expect(await measureOn(page, '[data-plitzi-el="room-card-quiet-demo"] [data-plitzi-el="room-card-idle"]')).toEqual({
      problem: expect.stringContaining(
        'room-card-quiet-demo is a component’s instance, marked data-plitzi-instance, not data-plitzi-el: write [data-plitzi-instance="room-card-quiet-demo"] [data-plitzi-el="room-card-idle"]'
      ) as unknown
    });
  });

  // The medal's fill fades in on its card's hover — measured by hand, with a script of design-1's own.
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

    // An open state — a drawer, then a panel in it — clicked in turn on each page, each settled.
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

    // A focus ring is drawn on `:focus-visible` — a keyboard's focus: a key pressed, then the element focused.
    acts.length = 0;
    expect(
      await putIn(
        stand(1, () => Promise.resolve()),
        { ...state, kind: 'focus' },
        'here'
      )
    ).toBeUndefined();
    expect(acts).toEqual(['press Shift', 'focus', 'settled']);

    // A menu opened, then an item of it hovered — the clicks first, the hover last, each settled.
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

  // Design-1 measured `.home-faq-answer-text` — the element's id, written as a class — and was told
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

  // `body` on our side read Times 400 and the noscript's words — the space's type is on its root.
  it("says, of a document's body measured on a space's page, the root to measure instead", () => {
    const body = { ...measured({}, ''), tag: 'body', selector: 'body', spaceRoot: 'shell-root' };

    expect(stripVTControlCharacters(measuredText(body, measured({}, '')))).toContain(
      'body is the document\'s: the space dresses its root, shell-root — measure it, "shell-root => body"'
    );
  });

  // Preparing a run's next run: our footer's label, held still, read "color 1e-05s cubic-bezier(0.4, 0, 0.2, 1)" against
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

  // The brief said "16px → 22.13px", and dev-1 tried three values before line-height 1.5.
  it('says a line height and a tracking as a share of the font beside their pixels', () => {
    const here = measured({ 'font-size': '14.75px', 'line-height': '16px', 'letter-spacing': '2.36px' });
    const there = measured({ 'font-size': '14.75px', 'line-height': '22.125px', 'letter-spacing': '2.36px' });

    expect(stripVTControlCharacters(measuredText(here, there))).toMatch(
      /≠ line-height\s+16px \(1\.085em\) {2}→ {2}22\.125px \(1\.5em\)/
    );
  });

  // A proof line failed on a font-size both inherit, which the task never touched.
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

  // The VS sizes in the acceptance were the lead's guess; a line that measures them proves them.
  it('takes the properties an acceptance holds to the other page, shorthands opened, and refuses what is not measured', () => {
    expect(sameProperties('font-size, border')).toEqual([
      'font-size',
      'border-top',
      'border-right',
      'border-bottom',
      'border-left'
    ]);
    expect(sameProperties('font')).toContain('letter-spacing');
    expect(() => sameProperties('font-size,glow!')).toThrow('not glow!');
  });

  // A fit asked for an element's box, and its 30 properties were grepped for it.
  it('prints only what is asked, its box a word — and refuses what is not measured, naming the flag', () => {
    expect(onlyProperties('box')).toEqual(['x', 'y', 'width', 'height', 'padding', 'margin']);
    expect(onlyProperties('box,font-size')).toContain('font-size');
    // encore-10's designer: a fixed bar's distance from the viewport's edge, --only right refused.
    expect(onlyProperties('right,bottom,top,left')).toEqual(['right', 'bottom', 'top', 'left']);
    // A run's designer sharing a row's rules: --only refused flex-direction, min-width and flex-grow.
    expect(onlyProperties('flex-direction,min-width,flex-grow,justify-content')).toEqual([
      'flex-direction',
      'min-width',
      'flex-grow',
      'justify-content'
    ]);
    expect(() => onlyProperties('overflow x')).toThrow('--only takes CSS properties by name');
  });

  // encore-13's designer checking a row still scrolls and snaps: --only refused all four, a list grown a run at a time.
  it('takes any CSS property by name, a pseudo-element’s too, read besides what always is', () => {
    const asked = onlyProperties('width,overflow-x,scroll-snap-type,after:margin-left,after:width,-webkit-line-clamp');
    expect(asked).toEqual([
      'width',
      'overflow-x',
      'scroll-snap-type',
      'after:margin-left',
      'after:width',
      '-webkit-line-clamp'
    ]);
    expect(extraOf(asked)).toEqual({
      properties: ['overflow-x', 'scroll-snap-type', '-webkit-line-clamp'],
      pseudo: ['margin-left']
    });
    // Compared as they are, beside what always is.
    const withOverflow = (value: string): Measured => {
      const read = measured({});

      return { ...read, styles: { ...read.styles, 'overflow-x': value } };
    };
    const [here, there] = [withOverflow('auto'), withOverflow('hidden')];
    expect(differences(here, there).differ).toEqual([{ property: 'overflow-x', here: 'auto', there: 'hidden' }]);
  });

  // A list's three plates were measured by their first alone, and their readouts differed (235/303/241 px).
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
      }) as unknown as Parameters<typeof copiesOf>[0];
    const pair = { here: '.show-plate', there: '.show-plate' };

    expect((await copiesOf(drawn(3), pair)).map(each => each.here)).toEqual([
      '.show-plate >> nth=0',
      '.show-plate >> nth=1',
      '.show-plate >> nth=2'
    ]);
    expect(await copiesOf(drawn(1), pair)).toEqual([pair]);
  });

  // A run's first measures: Cinzel with another fallback, borders of no width, one gold in two notations — noise.
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

  // ~150 calls, one element a call — each ours and theirs, written in one argument.
  it('reads "ours => theirs" as one element asked on both pages, and a name alone as the same on both', () => {
    expect(pairOf('fight-card-vs => .vs-medal')).toEqual({ here: 'fight-card-vs', there: '.vs-medal' });
    expect(pairOf('[data-plitzi-el="a"] > span=>.b span')).toEqual({
      here: '[data-plitzi-el="a"] > span',
      there: '.b span'
    });
    expect(pairOf('fight-card-vs')).toEqual({ here: 'fight-card-vs', there: 'fight-card-vs' });
  });

  // The VS medal's fill is on ::before — read as no fill, and the plan asked it away.
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
    expect(() => sameProperties('middle:opacity')).toThrow('not middle:opacity');
  });

  // Every element listed the page's font as differing, burying what the element itself does.
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

// A height 0.13px off failed an acceptance line, an agent tuned a margin to 63.93px to pass one, `--same
// margin-bottom` was refused, and every agent read positions with a browser script of its own.
describe('page measure, held to the pixel', () => {
  it('takes lengths within half a pixel as the same, and one a pixel off as different', () => {
    const tall = (height: string, margin = '0px') => measured({ height, margin });

    expect(differences(tall('404.984px'), tall('404.859px')).differ).toEqual([]);
    expect(differences(tall('1005.03px'), tall('1004.95px')).differ).toEqual([]);
    expect(differences(tall('405px'), tall('406px')).differ.map(each => each.property)).toEqual(['height']);
  });

  // The original's bullets were `list-style-position: inside`, which no reading showed, and an arrow's place
  // down a column could be neither measured nor held (`--same y` refused).
  // A reading of the original kept before `list-style` and `y` were measured answered "none" for both — two
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

  // A 1588px section of eighteen list items came 1.06px off, each line's rounding added up.
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

  // A hover that only underlined a link read as "nothing changed"; a hairline's ::after, centred or on the baseline,
  // was told from a picture.
  it('reads a link’s underline, and where a pseudo-element sits on its line or in its row', () => {
    const rest = measured({ 'text-decoration': 'none solid rgb(35, 26, 18)', 'after:vertical-align': 'baseline' });
    const hovered = measured({
      'text-decoration': 'underline 1px solid rgb(35, 26, 18)',
      'after:vertical-align': 'baseline'
    });

    expect(differences(rest, hovered).differ.map(each => each.property)).toEqual(['text-decoration']);
    const text = stripVTControlCharacters(
      measuredText(measured({ ...rest.styles, 'align-items': 'center', 'after:align-self': 'auto' }))
    );
    expect(text).toContain('align-items            center');
    expect(text).not.toContain('text-decoration');
    expect(text).not.toContain('after:vertical-align');
    expect(sameProperties('after:align-self,text-underline-offset')).toEqual([
      'after:align-self',
      'text-underline-offset'
    ]);
  });
});

// ~40 properties an element, a data URI whole in each — 38k characters in one answer, read on every turn.
describe('an element measured alone', () => {
  it('says what it says of itself: its initial and inherited values counted, a data URI by its kind and size', () => {
    const glow = `url("data:image/svg+xml,${'%3Cpath%20d%3D%22M0%200h1%22%2F%3E'.repeat(40)}")`;
    const sign: Measured = {
      selector: '[data-plitzi-el="home-sign"]',
      tag: 'div',
      text: 'ACME',
      styles: {
        'font-size': '32px',
        color: 'rgb(255, 176, 0)',
        'background-color': 'rgba(0, 0, 0, 0)',
        'background-image': glow,
        'box-shadow': 'none',
        animation: 'none 0s ease 0s 1 normal none running',
        'grid-area': 'auto / auto / auto / auto',
        'before:top': 'auto',
        'before:position': 'absolute',
        // As a browser says them with nothing set: a width of 0, a style of none, motion stilled for the reading.
        'border-top': '0px solid rgb(35, 26, 18)',
        outline: 'rgb(35, 26, 18) none 3px',
        transition: '1e-05s'
      },
      inherited: ['color'],
      matches: 6
    };

    const text = stripVTControlCharacters(measuredText(sign));
    expect(text).toContain('(the first shown of 6 it finds — --each measures each)');
    expect(text).toContain('font-size              32px');
    expect(text).toContain('before:position        absolute');
    expect(text).toMatch(/background-image +url\(data:image\/svg\+xml … \d+ chars\)/);
    expect(text).not.toContain('box-shadow');
    expect(text).not.toContain('rgb(255, 176, 0)');
    expect(text).toContain('(8 at their initial value, 1 inherited from its parent: --all says them)');
    expect(text).not.toContain('border-top');

    const all = stripVTControlCharacters(measuredText(sign, undefined, true));
    expect(all).toContain('box-shadow             none');
    expect(all).toContain(glow);
  });
});

// A designer reading four elements' width, x and y on one page was refused --same, and printed ~20 lines each.
describe('--same on one page', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    process.exitCode = undefined;
  });

  it('is refused naming --only, which prints just those', async () => {
    const project = await fs.mkdtemp(path.join(os.tmpdir(), 'plitzi-measure-'));
    const said: string[] = [];
    vi.spyOn(process, 'cwd').mockReturnValue(project);
    vi.spyOn(console, 'error').mockImplementation((line: unknown) => said.push(String(line)));
    try {
      await fs.writeFile(path.join(project, 'package.json'), '{"name":"site"}');
      await measure('/', ['legend'], { same: sameProperties('size,x') });
    } finally {
      await fs.rm(project, { recursive: true, force: true });
    }

    expect(process.exitCode).toBe(1);
    expect(stripVTControlCharacters(said.join('\n'))).toContain(
      "to print only some of this page's, --only width,height,x"
    );
  });
});

// A legend's hairline, its ::after: on the baseline or centred beside two lines was told from a picture.
describe('where a pseudo-element is drawn', () => {
  it('reads each one asked off the browser’s layout, down the page as an element’s y is', async () => {
    const asked: string[] = [];
    const answers: Record<string, unknown> = {
      'DOM.getDocument': { root: { nodeId: 1 } },
      'DOM.querySelector': { nodeId: 7 },
      'DOM.describeNode': {
        node: {
          pseudoElements: [
            { pseudoType: 'before', backendNodeId: 70 },
            { pseudoType: 'marker', backendNodeId: 71 },
            { pseudoType: 'after', backendNodeId: 72 }
          ]
        }
      }
    };
    const session = {
      send: (method: string, params: Record<string, unknown>) => {
        asked.push(`${method} ${JSON.stringify(params)}`);

        return Promise.resolve(
          method === 'DOM.getBoxModel'
            ? { model: { border: params.backendNodeId === 72 ? [131.9, 57.5, 348, 57.5] : [5, 7, 11, 7] } }
            : answers[method]
        );
      },
      detach: () => Promise.resolve()
    };

    // The fake answers the four methods `pseudoBoxes` sends, as Chromium does; the protocol has hundreds more.
    expect(
      await pseudoBoxes(session as unknown as LayoutSession, '[data-plitzi-measured="m1"]', ['after'], 50)
    ).toEqual({
      'after:x': '131.9px',
      'after:y': '107.5px'
    });
    expect(asked).toContain('DOM.querySelector {"nodeId":1,"selector":"[data-plitzi-measured=\\"m1\\"]"}');
    expect(asked.filter(each => each.startsWith('DOM.getBoxModel'))).toEqual(['DOM.getBoxModel {"backendNodeId":72}']);
    expect(PSEUDO_MEASURED).toEqual(expect.arrayContaining(['x', 'y']));
  });
});

// A run's measure of nine elements answered 23k characters: four borders alike on four lines, a rivet drawn four times.
describe('a reading said short', () => {
  it('says four borders alike as one, and a layer drawn again by how many times — --all says each whole', () => {
    const rivet = 'radial-gradient(circle, rgb(42, 31, 22) 0px, rgb(181, 165, 130) 3px, rgba(0, 0, 0, 0) 4.25px)';
    const panel: Measured = {
      selector: '[data-plitzi-el="inbox"]',
      tag: 'div',
      text: 'Inbox',
      styles: {
        'border-top': '2px solid rgb(42, 31, 22)',
        'border-right': '2px solid rgb(42, 31, 22)',
        'border-bottom': '2px solid rgb(42, 31, 22)',
        'border-left': '2px solid rgb(42, 31, 22)',
        'before:content': '""',
        'before:top': '6px',
        'before:right': '6px',
        'before:bottom': '6px',
        'before:left': '6px',
        'before:background-image': [rivet, rivet, rivet, rivet, 'linear-gradient(red, blue)'].join(', ')
      },
      inherited: []
    };

    const text = stripVTControlCharacters(measuredText(panel));
    expect(text).toContain('border                 2px solid rgb(42, 31, 22)');
    expect(text).not.toContain('border-top');
    expect(text).toContain('before:inset           6px');
    expect(text).not.toContain('before:top');
    expect(text).toContain(`before:background-image ${rivet} ×4, linear-gradient(red, blue)`);
    const whole = stripVTControlCharacters(measuredText(panel, undefined, true));
    expect(whole).toContain('border-left            2px solid rgb(42, 31, 22)');
    expect(whole).not.toContain('×4');
    const uneven = { ...panel, styles: { ...panel.styles, 'border-left': '0px none rgb(42, 31, 22)' } };
    expect(stripVTControlCharacters(measuredText(uneven))).toContain(
      'border-top             2px solid rgb(42, 31, 22)'
    );
  });
});

// A run's tester measured sixteen copies of a part where eight were drawn, and read why one was not eight times.
describe('why an element is not drawn', () => {
  it('is said whole once a measure, and pointed back to after', () => {
    const missing = (id: string) => ({
      width: 1440,
      pair: pairOf(id),
      here: { problem: `No element ${id} on http://127.0.0.1:8080/ — not drawn here: a page for signed-in visitors` },
      unlike: []
    });
    const said = saidOnce([missing('a'), missing('b')]);

    expect(said.map(reading => ('problem' in reading.here ? reading.here.problem : ''))).toEqual([
      'No element a on http://127.0.0.1:8080/ — not drawn here: a page for signed-in visitors',
      'No element b on http://127.0.0.1:8080/ — not drawn here either (why, above)'
    ]);
  });
});
