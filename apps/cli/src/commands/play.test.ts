import { stripVTControlCharacters } from 'node:util';

import { describe, expect, it } from 'vitest';

import { playedText, playOn, readTargets, sharedServerNote, stepsOf, unlikeIn, verdictOf } from './play';

import type { PlayedStep, PlaySide } from './play';
import type { ElementState } from './playState';

const at = (x: number, shown = true, enabled = true): ElementState => ({
  offset: { x, y: 0 },
  shown,
  enabled,
  text: '',
  aria: {},
  focused: false,
  inView: 'whole',
  colour: { text: 'rgb(0, 0, 0)', ground: 'rgb(255, 255, 255)' }
});

/** A row and its arrow, at the start and after one press — here and there. */
const played = (hereMove: number, thereMove: number, arrowThereShown: boolean): PlayedStep[] => [
  {
    step: 'start',
    reads: [
      { element: 'row => .slides', here: at(0), there: at(0) },
      { element: 'next => .next', here: at(-900), there: at(-900) }
    ]
  },
  {
    step: 'click next => .next',
    reads: [
      {
        element: 'row => .slides',
        here: at(hereMove),
        there: at(thereMove),
        moved: { here: { x: hereMove, y: 0 }, there: { x: thereMove, y: 0 } }
      },
      {
        element: 'next => .next',
        here: at(-900, false, false),
        there: at(-900, arrowThereShown, arrowThereShown),
        moved: { here: { x: 0, y: 0 }, there: { x: 0, y: 0 } }
      }
    ]
  }
];

// A carousel's arrows used there and back on both sites took two dozen browser scripts of the agents' own.
describe('page play', () => {
  it('holds each step to the other page: how far it moved, within a rounding, whether shown, whether it takes a press', () => {
    expect(unlikeIn(played(909, 909, false), ['moved', 'shown', 'enabled'])).toEqual([]);
    // A scroll and a transform a pixel apart are one move; a card and a group are not.
    expect(unlikeIn(played(910, 909, false), ['moved'])).toEqual([]);
    expect(unlikeIn(played(455, 909, false), ['moved'])).toEqual([
      'click next => .next: row => .slides moved 455px left here, 909px left there'
    ]);
    expect(unlikeIn(played(909, 909, true), ['shown', 'enabled'])).toEqual([
      'click next => .next: next => .next is hidden here, shown there',
      'click next => .next: next => .next takes no press here, takes a press there'
    ]);
    // Only what --same names is held.
    expect(unlikeIn(played(455, 909, true), ['shown'])).toHaveLength(1);
  });

  it('says a move of what moves, and none of what never does', () => {
    const lines = playedText(played(909, 909, false)).map(line => stripVTControlCharacters(line));

    expect(lines).toContain(
      '  row => .slides: moved 909px left, shown, enabled | there moved 909px left, shown, enabled'
    );
    expect(lines).toContain('  next => .next: hidden, no press | there hidden, no press');
  });

  // A tab drawn per width was hidden at 390, its press skipped without a word — and "✓ every step as
  // theirs" was said beside an element read that was not on the page.
  // Listen turning Mute, the focus back on the burger and a search typed each took a Playwright script.
  // Its picker, drawn once its button opens it, read "not on" at the start — and the line was no one's.
  it('says an element a step brings is not on the page yet, and one never there in red', () => {
    const lines = playedText([
      {
        step: 'start',
        reads: [
          { element: 'picker', problem: 'picker is not on http://x/' },
          { element: 'ghost', problem: 'ghost is not on http://x/' }
        ]
      },
      {
        step: 'click more',
        reads: [
          { element: 'picker', here: at(0) },
          { element: 'ghost', problem: 'ghost is not on http://x/' }
        ]
      }
    ]).map(line => stripVTControlCharacters(line));

    expect(lines).toContain('  picker: not on the page yet');
    // A run's `--read a,b`: said once, at the first step, not again at every step.
    expect(lines.filter(line => line.startsWith('  ghost:'))).toEqual([
      '  ghost: ghost is not on http://x/ (at every step)'
    ]);
  });

  it('says what a control says of itself: its words, its value, its ARIA states, its focus', () => {
    const toggle: ElementState = { ...at(0), text: 'Mute', aria: { pressed: 'true' }, focused: true };
    const search: ElementState = { ...at(0), text: '', value: 'lofi', aria: {} };

    expect(
      playedText([
        {
          step: 'click listen',
          reads: [
            { element: 'listen', here: toggle },
            { element: 'search', here: search }
          ]
        }
      ])
    ).toEqual([
      'click listen',
      '  listen: shown, enabled · focused · pressed true · "Mute"',
      '  search: shown, enabled · value "lofi"'
    ]);
  });

  // "shown" of a dialog under the header, half below the fold, and scaled to nothing — said as if in plain view.
  it('says where a shown element is when it is not plainly there: out of view, under another, transformed', () => {
    const below: ElementState = { ...at(0), inView: 'part' };
    const covered: ElementState = { ...at(0), coveredBy: 'site-header' };
    const scaled: ElementState = { ...at(0), inView: 'out', transform: 'scale 0, translate 0,40' };

    expect(
      playedText([
        {
          step: 'start',
          reads: [
            { element: 'dialog', here: below },
            { element: 'menu', here: covered },
            { element: 'toast', here: scaled },
            { element: 'plain', here: at(0) }
          ]
        }
      ])
    ).toEqual([
      'start',
      '  dialog: shown, enabled · partly in view',
      '  menu: shown, enabled · under site-header',
      '  toast: shown, enabled · out of view · scale 0, translate 0,40',
      '  plain: shown, enabled'
    ]);
  });

  it('says a step that did nothing on a side, and never passes one with an element not on the page', () => {
    const steps = played(909, 909, false);
    const idle: PlayedStep[] = [
      steps[0],
      { ...steps[1], idle: { there: '.next is not shown: the click did nothing' } }
    ];
    const lines = playedText(idle).map(line => stripVTControlCharacters(line));
    expect(lines).toContain('  there: .next is not shown: the click did nothing');

    const said = (missing: boolean, unlike: string[]) =>
      verdictOf(['shown'], unlike, missing, 'https://site.test/').map(line => stripVTControlCharacters(line));
    expect(said(true, [])).toEqual([
      '✗ --same shown: an element read is not on the page — nothing is held until it is'
    ]);
    expect(said(false, [])).toEqual(["✓ --same shown: every step as https://site.test/'s"]);
    expect(said(false, ['start: row is hidden here, shown there'])).toEqual([
      '✗ --same: start: row is hidden here, shown there'
    ]);
  });
});

// A filter link went to /rooms?sort=true unsaid; a tone picked changed a colour no read said; a reaction's
// float played and ended, read as "hidden" as though the press did nothing.
describe('what a step left', () => {
  it('says where the page went, a colour a step changed, and the animations an element has', () => {
    const tone = (text: string): ElementState => ({ ...at(0), colour: { text, ground: 'rgb(20, 20, 20)' } });
    const lines = playedText([
      { step: 'start', reads: [{ element: 'avatar', here: tone('rgb(255, 176, 0)') }] },
      {
        step: 'click tone-teal',
        went: { here: '/rooms?genre=synthwave' },
        reads: [
          {
            element: 'avatar',
            here: { ...tone('rgb(0, 160, 160)'), shown: false, animations: ['float finished'] }
          }
        ]
      }
    ]).map(line => stripVTControlCharacters(line));

    expect(lines).toEqual([
      'start',
      '  avatar: shown, enabled',
      'click tone-teal',
      '  → /rooms?genre=synthwave',
      '  avatar: hidden, enabled · float finished · colour now rgb(0, 160, 160) on rgb(20, 20, 20) (was rgb(255, 176, 0) on rgb(20, 20, 20))'
    ]);
  });
});

// Agents wrote `--read a,b,c` as `--width 390,1440` takes them, five times, and it was read as one element after every
// step had run — the demo's data used up; and `--steps ""` to read a page at rest had no way to say it.
describe('what page play is asked', () => {
  it('reads a comma list of element ids as each of them, and keeps a selector whole', () => {
    expect(readTargets(['crate-count,crate-list', 'room-key'])).toEqual(['crate-count', 'crate-list', 'room-key']);
    expect(readTargets(['.card, .row'])).toEqual(['.card, .row']);
  });

  it('reads the page as it rests with --read alone, and needs one of the two', () => {
    expect(stepsOf({ read: ['crate-count'] })).toEqual([]);
    expect(stepsOf({ steps: '  ', read: ['crate-count'] })).toEqual([]);
    expect(stepsOf({})).toEqual({
      problem: 'page play needs --steps — or --read alone, to read the page as it rests.'
    });
    expect(stepsOf({ steps: 'click save-key' })).toHaveLength(1);
  });
});

// A sticky preview read "moved 315px down" after a click on a switch out of view: the page's scroll to reach the switch.
describe('page play, a target out of view', () => {
  it('scrolls it into view before the step, and measures what moved from there', async () => {
    let scrolled = false;
    const acted: string[] = [];
    const side: PlaySide = {
      act: step => {
        acted.push(step.kind);
        scrolled ||= step.kind === 'scroll';

        return Promise.resolve(undefined);
      },
      read: targets =>
        Promise.resolve(
          targets.map(target =>
            target === 'switch'
              ? { ...at(0), inView: scrolled ? ('whole' as const) : ('out' as const) }
              : { ...at(0), offset: { x: 0, y: scrolled ? -315 : 0 } }
          )
        )
    };

    const result = await playOn(
      { here: side },
      [{ kind: 'click', target: 'switch' }],
      [{ here: 'preview', there: 'preview' }]
    );
    if (!('played' in result)) {
      throw new Error(result.problem);
    }

    expect(acted).toEqual(['scroll', 'click']);
    expect(result.played[1]).toMatchObject({ reached: true, reads: [{ moved: { here: { x: 0, y: 0 } } }] });
    expect(playedText(result.played).map(line => stripVTControlCharacters(line))).toContain(
      '  (scrolled into view first, as a pointer reaches it: moves are from there)'
    );
  });
});

// A run's crate queue gave its real answer at 1440 alone: at 390 the share was already spent on the same server.
describe('a play over several widths', () => {
  it('says the next width starts from what the first one’s acting steps changed', () => {
    expect(sharedServerNote(2, [{ kind: 'click' }])).toContain('Each width played on one server');
    expect(sharedServerNote(2, [{ kind: 'wait' }, { kind: 'hover' }])).toBeUndefined();
    expect(sharedServerNote(1, [{ kind: 'click' }])).toBeUndefined();
  });
});
