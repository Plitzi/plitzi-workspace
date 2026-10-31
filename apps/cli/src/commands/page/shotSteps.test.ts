import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { parseSteps, STEP_USAGE, stepsUsage, widthRange, widthRangeText } from './shotSteps';

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

  // `fill email=ana@x.com`, as `--fill` writes it, was refused in a step.
  it('reads a field filled as --fill writes it, an element named before its =', () => {
    expect(parseSteps('fill room-request-message=Para ti, Sam; type q=lofi', 500)).toEqual([
      { kind: 'type', target: 'room-request-message', text: 'Para ti, Sam' },
      { kind: 'type', target: 'q', text: 'lofi' }
    ]);
  });

  // `type [aria-label="Precio hasta"] 650` was cut at its first space into a selector that is none.
  // A run: `scroll <row> 200` reached Playwright as one selector and came back as its parse error.
  it('reads a scroll by whole pixels as the element’s own content moved, and refuses a number after any other', () => {
    expect(parseSteps('scroll explore-genres 200; scroll "[data-plitzi-el=feed] ul" 0 -80', 500)).toEqual([
      { kind: 'scroll', target: 'explore-genres', by: { dx: 200, dy: 0 } },
      { kind: 'scroll', target: '[data-plitzi-el=feed] ul', by: { dx: 0, dy: -80 } }
    ]);
    expect(parseSteps('click .panel button', 500)).toEqual([{ kind: 'click', target: '.panel button' }]);
    expect(parseSteps('click explore-genres 200', 500)).toEqual({
      problem:
        'step 1 ("click explore-genres 200"): click takes an element alone — 200 is no part of one (a selector with spaces goes in quotes)'
    });
    expect(parseSteps('scroll explore-genres 0', 500)).toEqual({
      problem:
        'step 1 ("scroll explore-genres 0"): scroll takes an element and how far its content goes, in whole pixels — scroll <element> <dx> [dy]: scroll genres 200'
    });
  });

  it('reads a selector with a space inside its brackets or quotes whole, unquoted', () => {
    expect(parseSteps('type [aria-label="Precio hasta"] 650; click button:has-text("Ver más")', 500)).toEqual([
      { kind: 'type', target: '[aria-label="Precio hasta"]', text: '650' },
      { kind: 'click', target: 'button:has-text("Ver más")' }
    ]);
  });

  // A range's handle could not be used — a click on it timed out, and no step moved it.
  it('reads a drag by whole pixels, either way, and refuses one that goes nowhere', () => {
    expect(parseSteps('drag price-max -120; drag [data-handle="low"] 40 8', 500)).toEqual([
      { kind: 'drag', target: 'price-max', dx: -120, dy: 0 },
      { kind: 'drag', target: '[data-handle="low"]', dx: 40, dy: 8 }
    ]);
    expect(parseSteps('drag price-max', 500)).toEqual({
      problem:
        'step 1 ("drag price-max"): drag needs an element and how far, in whole pixels — drag <element> <dx> [dy] [hold]: drag volume-handle -120, drag sheet-handle 0 -120 hold'
    });
  });

  // A run's designer and tester each wrote a Playwright probe to read a sheet while the finger was still on it.
  it('reads a drag held down for what follows, and the release that lets it go', () => {
    expect(parseSteps('drag sheet-handle 0 -120 hold; release', 500)).toEqual([
      { kind: 'drag', target: 'sheet-handle', dx: 0, dy: -120, held: true },
      { kind: 'release' }
    ]);
  });

  it('says which step is wrong, and what the steps are', () => {
    expect(parseSteps('click a; tap b', 500)).toEqual({
      problem:
        'step 2 ("tap b"): "tap" is not a step — the steps are click, hover, scroll, type, fill, drag, release, press, wait, wait-for, reload, goto, back, store, state, source, attribute, clock, tick, action, render, as, at, shot, frames'
    });
    expect(parseSteps('wait soon', 500)).toEqual({
      problem:
        'step 1 ("wait soon"): "soon" is not a wait from 1 ms to 30 s — milliseconds, or with its unit: wait 300, wait 3s'
    });
    expect(parseSteps('wait 31s', 500)).toEqual({
      problem:
        'step 1 ("wait 31s"): "31s" is not a wait from 1 ms to 30 s — milliseconds, or with its unit: wait 300, wait 3s'
    });
    // A run's designer wrote `wait 3s` and was refused: a duration reads with its unit.
    expect(parseSteps('wait 3s; wait 250', 500)).toEqual([
      { kind: 'wait', ms: 3000 },
      { kind: 'wait', ms: 250 }
    ]);
    expect(parseSteps('type title', 500)).toEqual({
      problem:
        'step 1 ("type title"): type needs an element and the text — type <element> <text> or type <element>=<text>, type ".panel textarea" hi'
    });
    expect(parseSteps('# only a note', 500)).toEqual({
      problem:
        '--steps has no step: click, hover, scroll, type, fill, drag, release, press, wait, wait-for, reload, goto, back, store, state, source, attribute, clock, tick, action, render, as, at, shot, frames, separated by ";"'
    });
  });

  // `drag product-slides => .js-media-list -200 0` was refused until the pair was quoted.
  it('reads an element named on both pages — ours => theirs — as one, before what a drag or a type takes', () => {
    expect(parseSteps('drag product-slides => .js-media-list -200 0; type q => ".search input" hola', 500)).toEqual([
      { kind: 'drag', target: 'product-slides => .js-media-list', dx: -200, dy: 0 },
      { kind: 'type', target: 'q => .search input', text: 'hola' }
    ]);
  });
});

// A choice kept across a reload, a countdown and a state the demo data never has were each a Playwright file.
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

  // A reviewer could not test a typing flag left on one page and come back to: no step went back.
  it('reads a way to another page of the session and back', () => {
    expect(parseSteps('type q hola; goto /rooms; back', 500)).toEqual([
      { kind: 'type', target: 'q', text: 'hola' },
      { kind: 'goto', path: '/rooms' },
      { kind: 'back' }
    ]);
  });

  // A designer approved a list it had only seen empty: nothing put a provider's answer on the page.
  it('reads a provider’s answer written where it keeps it, and refuses one with no value', () => {
    expect(parseSteps(`source apiContainer_chart.clapped '[{"title":"Night Drive"}]'`, 500)).toEqual([
      { kind: 'source', key: 'apiContainer_chart.clapped', value: [{ title: 'Night Drive' }] }
    ]);
    const problem = parseSteps('source apiContainer_chart.clapped', 500);
    expect('problem' in problem ? problem.problem : '').toContain("source needs a source's path");
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

  // A chat line holding ";" was cut there; `fill .chat-input=Great` was one selector; a quoted state, refused.
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

// A run's designer could not show a count another person's message moves, nor a room the demo data never puts in a state.
describe('the steps another account and the server play', () => {
  it('reads an action with its input, and a step another account plays', () => {
    expect(
      parseSteps(`action crate-hide '{"crate":"c1"}'; action rooms-reset; as mika type dm-input hi there`, 500)
    ).toEqual([
      { kind: 'action', action: 'crate-hide', input: { crate: 'c1' } },
      { kind: 'action', action: 'rooms-reset', input: {} },
      { kind: 'as', account: 'mika', step: { kind: 'type', target: 'dm-input', text: 'hi there' } }
    ]);
  });

  it('refuses an input that is no object, and an account with no step, a picture or another "as" to play', () => {
    expect(parseSteps('action crate-hide [1]', 500)).toEqual({
      problem: `step 1 ("action crate-hide [1]"): action needs the action's id and, when it takes one, its input as a JSON object — action dm-send '{"to":"juno","text":"hi"}'`
    });
    const problemOf = (script: string): string => {
      const parsed = parseSteps(script, 500);

      return 'problem' in parsed ? parsed.problem : '';
    };
    for (const script of ['as mika', 'as mika shot', 'as mika as juno click send']) {
      expect(problemOf(script)).toContain('as needs an account and one step it plays');
    }
    expect(problemOf('as mika tap send')).toContain('"tap" is not a step');
  });
});

// A tester waited for a state three tries of ten seconds bring with chained fixed waits: a wait-for gave up at 10 s.
describe('a wait-for with its time', () => {
  it('waits for a selector’s state as long as it says, up to 60 s — and is refused past it', () => {
    expect(parseSteps(`wait-for '[data-state="stalled"]' 40s`, 0)).toEqual([
      { kind: 'wait-for', target: '[data-state="stalled"]', ms: 40_000 }
    ]);
    expect(parseSteps('wait-for room-player', 0)).toEqual([{ kind: 'wait-for', target: 'room-player' }]);
    expect(parseSteps('wait-for room-player 90s', 0)).toEqual({
      problem: expect.stringContaining('wait-for takes an element and how long it waits at most, up to 60 s') as unknown
    });
  });
});

// A plugin's attribute no page bound yet could not be given a value for a look: only the page's state could.
describe('an attribute step', () => {
  it('names an element and its attribute, and takes the value as JSON', () => {
    expect(parseSteps(`attribute map.storms '[{"id":"ARNAB"}]'`, 500)).toEqual([
      { kind: 'attribute', key: 'map.storms', value: [{ id: 'ARNAB' }] }
    ]);
    expect(parseSteps('attribute map true', 500)).toMatchObject({
      problem: expect.stringContaining('<element>.<attribute>') as string
    });
  });
});

// A run's lead wrote its stage with a script, every check twice, as 390's steps opened a tab 1440 does not have.
describe('a step played at some widths', () => {
  it('names the widths and the one step played at them', () => {
    expect(parseSteps('at <=767 click sheet-tab-log; type log-search zzqqxx', 500)).toEqual([
      { kind: 'at', width: { min: 0, max: 767 }, step: { kind: 'click', target: 'sheet-tab-log' } },
      { kind: 'type', target: 'log-search', text: 'zzqqxx' }
    ]);
    expect(widthRange('390')).toEqual({ min: 390, max: 390 });
    expect(widthRange('<768')).toEqual({ min: 0, max: 767 });
    expect(widthRange('>767')).toEqual({ min: 768, max: Number.POSITIVE_INFINITY });
    expect(widthRangeText({ min: 768, max: Number.POSITIVE_INFINITY })).toBe('>=768');
  });

  it('is refused without widths, or with anything but one step of the page', () => {
    for (const script of [
      'at click sheet-tab-log',
      'at 390',
      'at 390 shot',
      'at 390 as mika click send',
      'at <0 click x'
    ]) {
      expect(parseSteps(script, 500)).toEqual({ problem: expect.stringContaining('at needs widths') as unknown });
    }
  });
});

// The help of page shot and page play, typed by hand, had left out half the steps: both are made from the one list.
describe('the steps the CLI teaches', () => {
  it('are every step it parses, each as it is written — in the help, and in its README', () => {
    const readme = fs.readFileSync(path.join(import.meta.dirname, '../../../README.md'), 'utf-8');
    for (const [name, usage] of STEP_USAGE) {
      expect(parseSteps(usage.replace(/<[^>]+>|\[[^\]]+\]/g, 'x'), 500)).not.toEqual({
        problem: expect.stringContaining(`"${name}" is not a step`) as unknown
      });
      expect(readme).toContain(`\`${usage}\``);
    }

    expect(stepsUsage(['frames'])).not.toContain('frames');
  });
});
