import { stripVTControlCharacters } from 'node:util';

import { describe, expect, it } from 'vitest';

import { playedText, unlikeIn, verdictOf } from './play';

import type { ElementState, PlayedStep } from './play';

const at = (x: number, shown = true, enabled = true): ElementState => ({
  offset: { x, y: 0 },
  shown,
  enabled,
  text: '',
  aria: {},
  focused: false
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

// lx-controls: a carousel's arrows used there and back on both sites took two dozen browser scripts of the agents' own.
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

  // lx-product: a tab drawn per width was hidden at 390, its press skipped without a word — and "✓ every step as
  // theirs" was said beside an element read that was not on the page.
  // encore: Listen turning Mute, the focus back on the burger and a search typed each took a Playwright script.
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
