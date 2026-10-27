import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { amendRun } from './amend';
import { expectedIds, madeTwice, partIdsOf } from './expectations';
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

// A lead planned follow-list on the followers page and on the following page, each its own file: an id is one element.
describe('an id two tasks make on two pages', () => {
  it('is said at run plan, once — an id one task expects on two pages is a shell part, never', () => {
    expect(
      madeTwice([
        { task: 't-followers', element: 'follow-list', pages: ['/u/ana/followers'] },
        { task: 't-following', element: 'follow-list', pages: ['/u/ana/following'] },
        { task: 't-following', element: 'follow-list', pages: ['/u/ana/following'] },
        { task: 't-nav', element: 'nav-home', pages: ['/', '/about'] }
      ])
    ).toEqual([
      "follow-list is expected by t-followers and t-following on /u/ana/followers and /u/ana/following, and the space has none now: an element's id is the space's, one element — each page names its own (or both place one component, made by one task)"
    ]);
  });
});

describe('a check as any shell runs it', () => {
  // A stage's plan named the run's primer (`primer.md`), not kept beside it, and its amend was refused.
  it('amends a stage whose plan names the run’s primer though none is beside it: the run’s, as kept', async () => {
    await bench.write('primer.md', '# What the project is\n');
    const opened = { ...benchPlan(), primer: 'primer.md' };
    await openRun(lead(), await bench.writePlan(opened));
    const stage = {
      version: 1 as const,
      runId: 'es-launch-2',
      goal: 'The contact page',
      primer: 'primer.md',
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
    await bench.write('primer.md', '# What the project is\n');
    await extendRun(lead(), 'es-launch', await bench.writePlan(stage));
    stage.tasks[0].acceptance = ['It says how to reach us, and when'];
    await bench.write('tmp/stages/es-launch-2.plan.json', JSON.stringify(stage));

    expect(
      await amendRun(lead(), 'es-launch', path.join(bench.root, 'tmp/stages/es-launch-2.plan.json'))
    ).toMatchObject({ tasks: [{ task: 't-contact', changed: ['acceptance'] }] });
  });

  // `run plan` said the space had no room-card-now — a part of the room card every room list places.
  it('counts a component’s parts, at any depth, as elements a check may expect', () => {
    const card = {
      id: 'room-card',
      root: {
        id: 'room-card-root',
        type: 'container',
        children: [{ id: 'room-card-now', type: 'text', children: [{ id: 'room-card-now-artist', type: 'text' }] }]
      }
    };

    expect(partIdsOf([card])).toEqual(['room-card-root', 'room-card-now', 'room-card-now-artist']);
  });

  it('has the copy served written in, and knows a Playwright spec needs it served', async () => {
    const { namesServedCopy, servesCopy, withServedValues } = await import('./acceptance');
    const values = { PLITZI_URL: 'http://127.0.0.1:8211', PLITZI_PORT: '8211' };

    expect(withServedValues('plitzi page check / --url $PLITZI_URL && echo ${PLITZI_PORT} $HOME', values)).toBe(
      'plitzi page check / --url http://127.0.0.1:8211 && echo 8211 $HOME'
    );
    expect(namesServedCopy('npx playwright test visual/walks.spec.ts')).toBe(true);
    expect(namesServedCopy('node --test src/space/lib/age.test.ts')).toBe(false);
    // A page command run in the copy reads its server: served once for every line, never by each line at once.
    expect(servesCopy('plitzi page check / /rooms --width 1440,390')).toBe(true);
    expect(servesCopy('plitzi page measure /design hero --width 390')).toBe(true);
    expect(servesCopy('node --test src/space/lib/age.test.ts')).toBe(false);
    expect(servesCopy("grep -q 'Menú' src/space/pages/menu.ts # plitzi page check /menu")).toBe(false);
    expect(servesCopy('plitzi page measure / #hero --width 390')).toBe(true);
  });
});
