import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { amendRun } from './amend';
import { expectedIds } from './expectations';
import { extendRun } from './extend';
import { loadRun, openRun } from './run';
import { meantOnPage } from '../commands/check';
import { benchPlan, makeBench } from '../tests/runProject';

import type { RunContext } from './run';
import type { Bench } from '../tests/runProject';

/** A stage stacked on a run, and the checks its plan's lines run: what they expect, and the copy they are served. */

let bench: Bench;

beforeEach(async () => {
  bench = await makeBench();
});

afterEach(async () => {
  await bench.cleanup();
});

const lead = (): RunContext => bench.agent('lead');

describe('a stage’s plan, and what its checks expect', () => {
  it('amends a run from the plan of a stage stacked on it: its tasks, and the run’s goal kept', async () => {
    await openRun(lead(), await bench.writePlan(benchPlan()));
    const stage = {
      version: 1 as const,
      runId: 'es-launch-2',
      goal: 'The contact page',
      tasks: [
        {
          id: 't-contact',
          title: 'Contact',
          files: ['src/space/pages/contact.ts'],
          dependsOn: [],
          priority: 'low' as const,
          estimateMinutes: 10,
          acceptance: ['It says how to reach us']
        }
      ]
    };
    await extendRun(lead(), 'es-launch', await bench.writePlan(stage));
    stage.tasks[0].acceptance = ['It says how to reach us, and when'];

    expect(await amendRun(lead(), 'es-launch', await bench.writePlan(stage))).toMatchObject({
      tasks: [{ task: 't-contact', changed: ['acceptance'] }]
    });
    const plan = (await loadRun(lead(), 'es-launch')).plan;
    expect(plan.goal).toBe('Spanish version of the pages · The contact page');
    expect(plan.tasks.map(task => task.id)).toContain('t-home');
  });

  it('reads the ids a page check expects, and says the page family’s for an id it scopes', () => {
    expect(
      expectedIds(
        'plitzi page check /pets/luna --url $PLITZI_URL --expect "/pets/luna age-label~old" --expect=title~Luna && echo ok'
      )
    ).toEqual([{ element: 'age-label', path: '/pets/luna' }, { element: 'title' }]);
    expect(meantOnPage('age-label', ['pet-luna-age-label', 'pet-kira-age-label', 'title'])).toContain(
      'one a page: pet-luna-age-label, pet-kira-age-label'
    );
    expect(meantOnPage('age-label', ['pet-luna-age-label'])).toContain('did you mean pet-luna-age-label?');
  });
});

describe('a check as any shell runs it', () => {
  it('has the copy served written in, and knows a Playwright spec needs it served', async () => {
    const { namesServedCopy, withServedValues } = await import('./acceptance');
    const values = { PLITZI_URL: 'http://127.0.0.1:8211', PLITZI_PORT: '8211' };

    expect(withServedValues('plitzi page check / --url $PLITZI_URL && echo ${PLITZI_PORT} $HOME', values)).toBe(
      'plitzi page check / --url http://127.0.0.1:8211 && echo 8211 $HOME'
    );
    expect(namesServedCopy('npx playwright test visual/walks.spec.ts')).toBe(true);
    expect(namesServedCopy('node --test src/space/lib/age.test.ts')).toBe(false);
  });
});
