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
        'step 2 ("tap b"): "tap" is not a step — the steps are click, hover, scroll, type, fill, drag, press, wait, wait-for, shot, frames'
    });
    expect(parseSteps('wait soon', 500)).toEqual({
      problem: 'step 1 ("wait soon"): "soon" is not a whole number from 1 to 30000'
    });
    expect(parseSteps('type title', 500)).toEqual({
      problem:
        'step 1 ("type title"): type needs an element and the text — type <element> <text>, type ".panel textarea" hi'
    });
    expect(parseSteps('# only a note', 500)).toEqual({
      problem:
        '--steps has no step: click, hover, scroll, type, fill, drag, press, wait, wait-for, shot, frames, separated by ";"'
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
