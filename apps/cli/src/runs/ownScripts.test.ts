import { describe, expect, it } from 'vitest';

import { ownScriptNotices, ownScriptsIn } from './ownScripts';

import type { RunPlan } from './model';

// lx-controls: the lead's acceptance checked a carousel and five article pages with two scripts of its own, unseen.
describe('an acceptance line checked by a script of one’s own', () => {
  it('is told by what runs a file — an interpreter given one, or the file itself — never a Plitzi or package command', () => {
    expect(ownScriptsIn('node /x/scratch/lead/checks/moves.mjs $PLITZI_URL / row next 1440')).toEqual([
      'node moves.mjs'
    ]);
    expect(ownScriptsIn('python3 -u probe.py && ./check.sh')).toEqual(['python3 probe.py', 'check.sh']);
    expect(ownScriptsIn('plitzi page play / --steps "click next" --read row')).toEqual([]);
    expect(ownScriptsIn('npm test -- reviews && npx playwright test visual/home.spec.ts')).toEqual([]);
    expect(ownScriptsIn('node --version')).toEqual([]);
  });

  it('is said at run plan with the Plitzi commands that would say it, and how to say what none can', () => {
    const tasks: RunPlan['tasks'] = [
      {
        id: 't-row',
        title: 'The row moves',
        files: ['src/space/pages/home.ts'],
        dependsOn: [],
        priority: 'high',
        estimateMinutes: 20,
        acceptance: [{ said: 'Next moves the row', check: 'node checks/moves.mjs $PLITZI_URL / row next' }]
      }
    ];

    expect(ownScriptNotices(tasks)).toEqual([
      expect.stringContaining(
        'Task "t-row": "Next moves the row" runs a script of yours (node moves.mjs) — written with Plitzi (page play'
      )
    ]);
  });
});
