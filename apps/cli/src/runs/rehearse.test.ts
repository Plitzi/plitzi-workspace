import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { readOwnership } from './ownership';
import { checkPlan } from './plan';
import { rehearsalText, rehearse } from './rehearse';
import { benchPlan, makeBench, teamFor } from '../tests/runProject';

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
  const checked = await checkPlan(bench.root, plan, ownership, teamFor(plan, options.agents));

  return rehearse(checked.tasks, options, { ownership, created: checked.created });
};

describe('a plan rehearsed before any agent starts', () => {
  // The testers review, each one at a time: two of them review t-home and t-menu at once, nothing waits.
  it('plays the reviews by the team’s testers, each one at a time', async () => {
    const played = await rehearsed(benchPlan(), {
      agents: 2,
      reviewMinutes: 5,
      reviewers: { by: 'testers', count: 2 }
    });

    expect(played.scheduled.find(task => task.task === 't-menu')).toMatchObject({ approved: 25, waitedForReview: 0 });
    expect(played.reviews).toMatchObject({ by: 'testers', count: 2, longestWait: 0 });
  });

  // A lone tester's own tasks were played into its own queue: no tester may review them — a developer does, its time
  // taken from its work.
  it('plays a lone tester’s own tasks reviewed by a developer', async () => {
    const plan = benchPlan();
    plan.tasks = plan.tasks.map(task => (task.id === 't-menu' ? { ...task, role: 'tester' } : task));
    const played = await rehearsed(plan, {
      agents: 2,
      roles: { tester: 1 },
      reviewMinutes: 5,
      reviewers: { by: 'testers', count: 1 }
    });

    expect(played.reviews).toMatchObject({ by: 'testers', count: 1, byDevelopers: 1 });
    expect(rehearsalText('es-launch', played, 5)).toContain('1 of them by a developer');
  });

  // Never by its author: one developer that wrote what they test leaves them to the tester.
  it('plays a task of tests by one that did not write what it tests — the tester when no developer may', async () => {
    const plan = benchPlan();
    const home = plan.tasks.find(task => task.id === 't-home') ?? plan.tasks[0];
    plan.tasks = [
      home,
      { ...home, id: 't-home-tests', files: ['src/lib/homeChecks.ts'], dependsOn: ['t-home'], testsOf: ['t-home'] }
    ];
    const played = await rehearsed(plan, {
      agents: 2,
      roles: { developer: 1, tester: 1 },
      reviewMinutes: 5,
      reviewers: { by: 'testers', count: 1 }
    });

    const by = new Map(played.scheduled.map(task => [task.task, task.agent]));
    expect(by.get('t-home')).not.toBe(by.get('t-home-tests'));
    expect(by.get('t-home-tests')).toMatch(/^tester-/);
  });

  it('plays it as task next would hand it out, the lead reviewing one at a time, what waits ready once approved', async () => {
    const played = await rehearsed(benchPlan(), { agents: 2, reviewMinutes: 5 });

    expect(played.scheduled.map(task => [task.task, task.agent, task.start, task.complete, task.approved])).toEqual([
      ['t-home', 'agent-1', 0, 20, 25],
      ['t-menu', 'agent-2', 0, 20, 30],
      ['t-about', 'agent-1', 20, 30, 35],
      ['t-book', 'agent-1', 30, 50, 55]
    ]);
    expect(played.wallMinutes).toBe(55);
    expect(played.reviews).toEqual({
      by: 'lead',
      count: 1,
      reviews: 4,
      busyMinutes: 20,
      longestWait: 5,
      byDevelopers: 0
    });
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
    // A page made with its parts in a folder of their own: the page puts them together — two such tasks were said to
    // register in the space's entry at once.
    plan.tasks.push(
      ...['inbox', 'thread'].map(name => ({
        id: `t-${name}`,
        title: `The ${name}`,
        files: [`src/space/pages/${name}.ts`, `src/space/messages/${name}.ts`, `src/space/messages/${name}Styles.ts`],
        dependsOn: [],
        priority: 'medium' as const,
        estimateMinutes: 15,
        acceptance: [`There is the ${name}`]
      }))
    );
    const played = await rehearsed(plan, { agents: 6, reviewMinutes: 5 });

    expect(played.contention).toEqual([]);
  });

  // A picker queue.ts places and a band home.ts stacks were said to register in the space's entry, at once.
  it('reads a module made beside a file the task changes as that file’s to import: it registers nowhere', async () => {
    const plan = benchPlan();
    plan.tasks.push(
      ...[
        ['picker', 'src/space/theme.ts'],
        ['band', 'src/space/tokens.ts']
      ].map(([name, beside]) => ({
        id: `t-${name}`,
        title: `A ${name}`,
        files: [beside, `src/space/${name}.ts`],
        dependsOn: [],
        priority: 'medium' as const,
        estimateMinutes: 15,
        acceptance: [`There is a ${name}`]
      }))
    );
    const played = await rehearsed(plan, { agents: 6, reviewMinutes: 5 });

    expect(played.contention.filter(each => each.file === 'src/space/index.ts')).toEqual([]);
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
    // Each names the command that does it: the rehearsal takes no roles of its own.
    expect(staffed.advice.join('\n')).toContain('give their role an agent (plitzi run team set <name> --roles …)');
    expect(staffed.advice.find(line => line.startsWith('With no agent held to a role, 1 agent finishes'))).toMatch(
      /\(plitzi run team set <name> --roles …\)$/
    );
  });
});
