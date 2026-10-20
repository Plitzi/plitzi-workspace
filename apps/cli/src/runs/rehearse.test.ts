import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { readOwnership } from './ownership';
import { checkPlan } from './plan';
import { rehearsalText, rehearse } from './rehearse';
import { benchPlan, makeBench } from '../tests/runProject';

import type { RunPlan } from './model';
import type { RehearsalOptions } from './rehearse';
import type { Bench } from '../tests/runProject';

let bench: Bench;

beforeEach(async () => {
  bench = await makeBench();
});

afterEach(async () => {
  await bench.cleanup();
});

const rehearsed = async (plan: RunPlan, options: RehearsalOptions): Promise<ReturnType<typeof rehearse>> => {
  const ownership = await readOwnership(bench.root);
  const checked = await checkPlan(bench.root, plan, ownership, options.agents);

  return rehearse(checked.tasks, options, { ownership, created: checked.created });
};

describe('a plan rehearsed before any agent starts', () => {
  it('plays it as task next would hand it out, the lead reviewing one at a time, what waits ready once approved', async () => {
    const played = await rehearsed(benchPlan(), { agents: 2, reviewMinutes: 5 });

    expect(played.scheduled.map(task => [task.task, task.agent, task.start, task.complete, task.approved])).toEqual([
      ['t-home', 'agent-1', 0, 20, 25],
      ['t-menu', 'agent-2', 0, 20, 30],
      ['t-about', 'agent-1', 20, 30, 35],
      ['t-book', 'agent-1', 30, 50, 55]
    ]);
    expect(played.wallMinutes).toBe(55);
    expect(played.lead).toEqual({ reviews: 4, busyMinutes: 20, longestWait: 5 });
    expect(played.criticalPath).toEqual({ tasks: ['t-home', 't-book'], minutes: 40 });
    expect(played.team.find(agent => agent.agent === 'agent-2')).toMatchObject({ tasks: ['t-menu'], idleMinutes: 35 });
    expect(played.scale).toEqual([
      { agents: 1, wallMinutes: 75 },
      { agents: 2, wallMinutes: 55 },
      { agents: 3, wallMinutes: 55 },
      { agents: 4, wallMinutes: 55 }
    ]);
  });

  it('says more agents add nothing, and the critical path decides when it does', async () => {
    const played = await rehearsed(benchPlan(), { agents: 4, reviewMinutes: 5 });
    const text = rehearsalText('es-launch', played, 5);

    expect(played.advice.join('\n')).toContain('2 agents finish as soon as 4 (55 min)');
    expect(text).toContain('Critical path: t-home → t-book (40 min of work)');
    expect(text).toContain('By agents: 1 → 75 min, 2 → 55 min');
  });

  it('reads a folder of pages loaded by convention as imported, and a page made there registers nowhere', async () => {
    await bench.write(
      'src/space/index.ts',
      `import { pagesIn } from '@plitzi/sdk-authoring/node';
import { tokens } from './tokens.ts';

export const space = { tokens, pages: await pagesIn(new URL('./pages/', import.meta.url)) };
`
    );
    const ownership = await readOwnership(bench.root);

    expect(ownership.pageFolders).toEqual(['src/space/pages']);
    expect(ownership.units.map(unit => unit.unit)).toEqual(
      expect.arrayContaining(['src/space/pages/about.ts', 'src/space/pages/home/index.ts', 'src/space/pages/menu.ts'])
    );
    expect(ownership.ownerOf.get('src/space/pages/home/hero.ts')).toBe('src/space/pages/home/index.ts');

    const plan = benchPlan();
    plan.tasks.push(
      ...['contact', 'faq'].map(name => ({
        id: `t-${name}`,
        title: `A ${name} page`,
        files: [`src/space/pages/${name}.ts`],
        dependsOn: [],
        priority: 'medium' as const,
        estimateMinutes: 15,
        acceptance: [`There is a ${name} page`]
      }))
    );
    const played = await rehearsed(plan, { agents: 6, reviewMinutes: 5 });

    expect(played.contention).toEqual([]);
  });

  it('finds the pages made at once registering in one entry, and what a role held leaves nobody to take', async () => {
    const plan = benchPlan();
    plan.tasks.push(
      {
        id: 't-contact',
        title: 'Contact page',
        files: ['src/space/pages/contact.ts'],
        dependsOn: [],
        priority: 'medium',
        estimateMinutes: 15,
        acceptance: ['There is a contact page']
      },
      {
        id: 't-faq',
        title: 'FAQ page',
        files: ['src/space/pages/faq.ts'],
        dependsOn: [],
        priority: 'medium',
        estimateMinutes: 15,
        acceptance: ['There is a FAQ page'],
        role: 'writer',
        touches: ['src/space/tokens.ts']
      },
      {
        id: 't-tokens',
        title: 'Warmer ink',
        files: ['src/space/tokens.ts'],
        dependsOn: [],
        priority: 'low',
        estimateMinutes: 10,
        acceptance: ['The ink is warmer']
      }
    );
    const played = await rehearsed(plan, { agents: 7, reviewMinutes: 5 });

    expect(played.contention).toEqual([
      expect.objectContaining({ file: 'src/space/index.ts', tasks: ['t-contact', 't-faq'], why: 'registers' }),
      expect.objectContaining({ file: 'src/space/tokens.ts', tasks: ['t-faq', 't-tokens'], heldBy: 't-tokens' })
    ]);
    expect(rehearsalText('es-launch', played, 5)).toContain('t-tokens holds it while the others change it');
    expect(played.advice.join('\n')).toContain('register themselves by folder');

    const staffed = await rehearsed(plan, { agents: 1, roles: { designer: 1 }, reviewMinutes: 5 });
    expect(staffed.unstaffed).toEqual(['t-about', 't-book', 't-contact', 't-faq', 't-home', 't-menu', 't-tokens']);
    expect(staffed.scale[0]).toEqual({ agents: 1, wallMinutes: null });
    expect(staffed.scheduled).toEqual([]);
    expect(staffed.advice.join('\n')).toContain('give their role an agent');
  });
});
