import { describe, expect, it } from 'vitest';

import { combineExperience, experienceFrom, experienceText } from './experience';
import { isRunRefusal } from '../core/refusal';

import type { Experience } from './experience';
import type { TaskRoundReport } from './taskReports';

/** What it was like to work with Plitzi: said by each who worked, and combined by the run. */

const refusalOf = (run: () => unknown): string => {
  try {
    run();
  } catch (error) {
    return isRunRefusal(error) ? error.message : String(error);
  }

  return '';
};

describe('an experience as a command takes it', () => {
  it('asks the ease and what cost the most before anything runs — naming the flags, and a wrong ease', () => {
    expect(refusalOf(() => experienceFrom({}, 'task complete'))).toContain(
      'task complete says what it was like to work with Plitzi: --ease, 1 (you fought Plitzi) to 5 (it got out of the way); --hardest "what cost you the most, and why"'
    );
    expect(refusalOf(() => experienceFrom({ ease: '7', hardest: 'x' }, 'task complete'))).toContain('(not "7")');
    expect(
      experienceFrom(
        { ease: '3', hardest: ' The realtime sync ', friction: ['page play has no --as', ' '], helped: ['task look'] },
        'task complete'
      )
    ).toEqual({ ease: 3, hardest: 'The realtime sync', frictions: ['page play has no --as'], helped: ['task look'] });
  });
});

const round = (agent: string, task: string, experience?: Experience): TaskRoundReport => ({
  version: 1,
  task,
  round: 1,
  agent,
  from: '2026-10-24T10:00:00.000Z',
  to: '2026-10-24T10:10:00.000Z',
  minutes: 10,
  sessions: [],
  checks: { run: 0, failed: 0, notOwn: 0, byStep: {}, why: [] },
  refusals: [],
  commands: { run: 0, failed: 0, chars: 0, seconds: 0, byName: {} },
  errors: [],
  explain: { asked: [], missed: [] },
  notices: [],
  ...(experience ? { experience } : {})
});

describe('the run’s experience, combined', () => {
  it('groups what several said alike, the most said first — with each one who said it — and the lead’s with them', () => {
    const asNoSignIn = (agent: string, words: string): Experience => ({
      ease: agent === 'design-1' ? 2 : 4,
      hardest: 'Proving a control for signed-in visitors',
      frictions: [words],
      helped: []
    });
    const combined = combineExperience(
      [
        round('dev-1', 't-player', asNoSignIn('dev-1', 'page play has no --as, a signed-in control cannot be played')),
        round('dev-3', 't-host', asNoSignIn('dev-3', 'page play cannot sign in: no --as for a signed-in control')),
        round('design-1', 't-settings', asNoSignIn('design-1', 'page play has no --as <user>')),
        round('dev-2', 't-queue')
      ],
      {
        ease: 3,
        hardest: 'Launching agents by hand',
        frictions: ['run watch woke me for a note'],
        helped: ['run status']
      }
    );

    // The lead's 3 counts with the rounds': 2, 3, 4, 4.
    expect(combined.ease).toEqual({
      median: 3,
      byAgent: [
        { agent: 'dev-1', rounds: 1, median: 4 },
        { agent: 'dev-3', rounds: 1, median: 4 },
        { agent: 'design-1', rounds: 1, median: 2 }
      ],
      lowest: [
        {
          agent: 'design-1',
          task: 't-settings',
          round: 1,
          ease: 2,
          hardest: 'Proving a control for signed-in visitors'
        }
      ]
    });
    expect(combined.frictions.map(each => [each.text, each.by.map(by => by.agent)])).toEqual([
      ['page play has no --as, a signed-in control cannot be played', ['dev-1', 'dev-3', 'design-1']],
      ['run watch woke me for a note', ['lead']]
    ]);
    expect(combined.hardest[0].by).toHaveLength(3);
    expect(combined.unsaid).toBe(1);
    expect(experienceText(combined)).toContain(
      '- page play has no --as, a signed-in control cannot be played — 3 said it: dev-1 at t-player, dev-3 at t-host, design-1 at t-settings'
    );
  });
});
