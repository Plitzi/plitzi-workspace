import { describe, expect, it } from 'vitest';

import { parseSteps } from './shotSteps';

describe('page shot --steps', () => {
  it('reads every step, separated by ";" or a new line, with the notes left out', () => {
    expect(
      parseSteps(
        `# open the machine
click .gm__knob; wait 300; frames 3 150
type title "Notes from the seed"
press Enter; wait-for .gm__capsule; shot opened; frames 2`,
        500
      )
    ).toEqual([
      { kind: 'click', target: '.gm__knob' },
      { kind: 'wait', ms: 300 },
      { kind: 'frames', count: 3, every: 150 },
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

  it('says which step is wrong, and what the steps are', () => {
    expect(parseSteps('click a; tap b', 500)).toEqual({
      problem: 'step 2 ("tap b"): "tap" is not a step — the steps are click, type, press, wait, wait-for, shot, frames'
    });
    expect(parseSteps('wait soon', 500)).toEqual({
      problem: 'step 1 ("wait soon"): "soon" is not a whole number from 1 to 30000'
    });
    expect(parseSteps('type title', 500)).toEqual({
      problem:
        'step 1 ("type title"): type needs an element and the text — type <element> <text>, type ".panel textarea" hi'
    });
    expect(parseSteps('# only a note', 500)).toEqual({
      problem: '--steps has no step: click, type, press, wait, wait-for, shot or frames, separated by ";"'
    });
  });
});
