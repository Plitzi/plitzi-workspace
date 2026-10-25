import { describe, expect, it } from 'vitest';

import { parseSteps } from './shotSteps';

describe('page shot --steps', () => {
  it('reads a scroll to an element: the footer brought into view, as a reader would', () => {
    expect(parseSteps('scroll site-footer; shot footer', 500)).toEqual([
      { kind: 'scroll', target: 'site-footer' },
      { kind: 'shot', label: 'footer' }
    ]);
  });

  it('reads every step, separated by ";" or a new line, with the notes left out', () => {
    expect(
      parseSteps(
        `# open the machine
click .gm__knob; wait 300; frames 3 150
hover home-cta
type title "Notes from the seed"
press Enter; wait-for .gm__capsule; shot opened; frames 2`,
        500
      )
    ).toEqual([
      { kind: 'click', target: '.gm__knob' },
      { kind: 'wait', ms: 300 },
      { kind: 'frames', count: 3, every: 150 },
      { kind: 'hover', target: 'home-cta' },
      { kind: 'type', target: 'title', text: 'Notes from the seed' },
      { kind: 'press', key: 'Enter' },
      { kind: 'wait-for', target: '.gm__capsule' },
      { kind: 'shot', label: 'opened' },
      { kind: 'frames', count: 2, every: 500 }
    ]);
  });

  /** Cut at its first space, `.composer textarea hola` typed "textarea hola" into `.composer`, and said nothing. */
  it('reads an element with a space in it whole when it is quoted', () => {
    expect(parseSteps('type ".oc-composer textarea" Café a las 9; type \'textarea\' "hola"', 500)).toEqual([
      { kind: 'type', target: '.oc-composer textarea', text: 'Café a las 9' },
      { kind: 'type', target: 'textarea', text: 'hola' }
    ]);
  });

  // encore-3: `fill email=ana@x.com`, as `--fill` writes it, was refused in a step.
  it('reads a field filled as --fill writes it, an element named before its =', () => {
    expect(parseSteps('fill room-request-message=Para ti, Sam; type q=lofi', 500)).toEqual([
      { kind: 'type', target: 'room-request-message', text: 'Para ti, Sam' },
      { kind: 'type', target: 'q', text: 'lofi' }
    ]);
  });

  // lx-controls: `type [aria-label="Precio hasta"] 650` was cut at its first space into a selector that is none.
  it('reads a selector with a space inside its brackets or quotes whole, unquoted', () => {
    expect(parseSteps('type [aria-label="Precio hasta"] 650; click button:has-text("Ver más")', 500)).toEqual([
      { kind: 'type', target: '[aria-label="Precio hasta"]', text: '650' },
      { kind: 'click', target: 'button:has-text("Ver más")' }
    ]);
  });

  // lx-controls: a range's handle could not be used — a click on it timed out, and no step moved it.
  it('reads a drag by whole pixels, either way, and refuses one that goes nowhere', () => {
    expect(parseSteps('drag price-max -120; drag [data-handle="low"] 40 8', 500)).toEqual([
      { kind: 'drag', target: 'price-max', dx: -120, dy: 0 },
      { kind: 'drag', target: '[data-handle="low"]', dx: 40, dy: 8 }
    ]);
    expect(parseSteps('drag price-max', 500)).toEqual({
      problem:
        'step 1 ("drag price-max"): drag needs an element and how far, in whole pixels — drag <element> <dx> [dy]: drag volume-handle -120'
    });
  });

  it('says which step is wrong, and what the steps are', () => {
    expect(parseSteps('click a; tap b', 500)).toEqual({
      problem:
        'step 2 ("tap b"): "tap" is not a step — the steps are click, hover, scroll, type, fill, drag, press, wait, wait-for, reload, goto, store, state, clock, tick, shot, frames'
    });
    expect(parseSteps('wait soon', 500)).toEqual({
      problem: 'step 1 ("wait soon"): "soon" is not a whole number from 1 to 30000'
    });
    expect(parseSteps('type title', 500)).toEqual({
      problem:
        'step 1 ("type title"): type needs an element and the text — type <element> <text> or type <element>=<text>, type ".panel textarea" hi'
    });
    expect(parseSteps('# only a note', 500)).toEqual({
      problem:
        '--steps has no step: click, hover, scroll, type, fill, drag, press, wait, wait-for, reload, goto, store, state, clock, tick, shot, frames, separated by ";"'
    });
  });

  // lx-product: `drag product-slides => .js-media-list -200 0` was refused until the pair was quoted.
  it('reads an element named on both pages — ours => theirs — as one, before what a drag or a type takes', () => {
    expect(parseSteps('drag product-slides => .js-media-list -200 0; type q => ".search input" hola', 500)).toEqual([
      { kind: 'drag', target: 'product-slides => .js-media-list', dx: -200, dy: 0 },
      { kind: 'type', target: 'q => .search input', text: 'hola' }
    ]);
  });
});

// encore-3: a choice kept across a reload, a countdown and a state the demo data never has were each a Playwright file.
describe('the steps that set what a page remembers and what time it is', () => {
  it('reads a reload, a stored value, a state written, the clock set and moved on', () => {
    expect(
      parseSteps(
        'store listen-choice on; reload; state roomOpen true; state show {"title":"Late set"}; clock 2026-10-25T20:00:00Z; tick 5m; tick 1500',
        500
      )
    ).toEqual([
      { kind: 'store', key: 'listen-choice', value: 'on' },
      { kind: 'reload' },
      { kind: 'state', key: 'roomOpen', value: true },
      { kind: 'state', key: 'show', value: { title: 'Late set' } },
      { kind: 'clock', time: Date.parse('2026-10-25T20:00:00Z') },
      { kind: 'tick', ms: 300_000 },
      { kind: 'tick', ms: 1500 }
    ]);
  });

  it('refuses each written wrong, saying how it is written', () => {
    const problemOf = (script: string): string => {
      const parsed = parseSteps(script, 500);

      return 'problem' in parsed ? parsed.problem : '';
    };

    expect(problemOf('state roomOpen')).toContain('its value as JSON');
    expect(problemOf('clock tomorrow')).toContain('clock 2026-10-25T20:00:00Z');
    expect(problemOf('tick 8d')).toContain('up to a week');
    expect(problemOf('store only-a-key')).toContain('a key and its value');
  });

  // encore-4: a chat line holding ";" was cut there; `fill .chat-input=Great` was one selector; a quoted state, refused.
  it('reads a ";" inside quotes as the text’s, a class before =, a state quoted as a shell writes it, and goto', () => {
    expect(
      parseSteps(
        `type chat-input "late; still here"; fill .chat-input=Great; state dismissed '"show-1"'; goto /rooms`,
        500
      )
    ).toEqual([
      { kind: 'type', target: 'chat-input', text: 'late; still here' },
      { kind: 'type', target: '.chat-input', text: 'Great' },
      { kind: 'state', key: 'dismissed', value: 'show-1' },
      { kind: 'goto', path: '/rooms' }
    ]);
    const problem = parseSteps('state dismissed show-1', 500);
    expect('problem' in problem ? problem.problem : '').toContain('got show-1: a text in double quotes');
    const nowhere = parseSteps('goto rooms', 500);
    expect('problem' in nowhere ? nowhere.problem : '').toContain('goto needs a path of the site');
  });
});
