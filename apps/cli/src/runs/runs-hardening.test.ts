import fs from 'node:fs/promises';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { amendRun } from './amend';
import { finishRun } from './merge';
import { readOwnership } from './ownership';
import { runPaths } from './paths';
import { checkPlan, PlanRefusal } from './plan';
import { answerProposal, proposeChange } from './proposals';
import { writeSummary } from './report';
import { checkPlanFile, openRun } from './run';
import { tellLead } from './talk';
import { readInbox } from './talk';
import {
  canWrite,
  completeTask,
  notReviewedIn,
  reassignTask,
  reportProgress,
  requestShared,
  reviewTask,
  takeNext
} from './tasks';
import { setTeamAgent } from './team';
import { viewRun } from './view';
import { benchPlan, makeBench, teamFor, writeInCopy } from '../tests/runProject';
import { runSteps } from '../tests/runSteps';

import type { Bench } from '../tests/runProject';

/** What an agent can do around the rules — after its review, by a link, under another's name — and what holds. */

let bench: Bench;

beforeEach(async () => {
  bench = await makeBench();
});

afterEach(async () => {
  await bench.cleanup();
});

const { refusal, lead, open, take, doTask } = runSteps(() => bench);

describe('what goes to review is what is approved', () => {
  it('merges the version that went to review, not what its copy holds since — and says so', async () => {
    const runId = await open();
    const held = await take('agent-1', 't-menu');
    await writeInCopy(held.work, 'src/space/pages/menu.ts', 'export const menu = { title: "Menú" };\n');
    await completeTask(held.ctx, runId, 't-menu');

    // Written in the copy after it went to review: neither the change of its file nor a file made since goes in.
    await writeInCopy(held.work, 'src/space/pages/menu.ts', 'export const menu = { title: "slipped in" };\n');
    await writeInCopy(held.work, 'src/space/pages/late.ts', 'export const late = 1;\n');
    expect(await notReviewedIn(lead(), runId, 't-menu')).toEqual([
      'src/space/pages/late.ts',
      'src/space/pages/menu.ts'
    ]);

    const reviewed = await reviewTask(lead(), runId, 't-menu', 'approve', []);
    expect(reviewed).toMatchObject({
      merged: ['src/space/pages/menu.ts'],
      notReviewed: ['src/space/pages/late.ts', 'src/space/pages/menu.ts']
    });

    await finishRun(bench.person(), runId, { apply: true, leavePending: true });
    expect(await bench.read('src/space/pages/menu.ts')).toContain('Menú');
    expect(await bench.read('src/space/pages/late.ts')).toBeUndefined();
  });

  it('counts a file it requested as sent at the version it asked for — not as written after', async () => {
    const runId = await open();
    const held = await take('agent-1', 't-menu');
    await writeInCopy(held.work, 'src/space/pages/menu.ts', 'export const menu = { title: "Menú" };\n');
    await writeInCopy(held.work, 'src/space/index.ts', 'export const space = { pages: [] };\n');
    // Shared and held by another first: it goes as a request.
    const other = await take('agent-2', 't-about');
    await writeInCopy(other.work, 'src/space/index.ts', 'export const space = { pages: ["about"] };\n');
    await writeInCopy(other.work, 'src/space/pages/about.ts', 'export const about = { title: "Sobre" };\n');
    await completeTask(other.ctx, runId, 't-about');
    const completed = await completeTask(held.ctx, runId, 't-menu');
    expect(completed.requests.map(request => request.file)).toEqual(['src/space/index.ts']);

    expect(await notReviewedIn(lead(), runId, 't-menu')).toEqual([]);
  });

  it('refuses two files made by one name in two tasks: the second is the lead’s to decide, never put together', async () => {
    const runId = await open();
    const first = await take('agent-1', 't-menu');
    const second = await take('agent-2', 't-about');
    await writeInCopy(first.work, 'src/space/lib/money.ts', 'export const euros = 1;\n');
    await writeInCopy(second.work, 'src/space/lib/money.ts', 'export const pounds = 2;\n');
    await writeInCopy(first.work, 'src/space/pages/menu.ts', 'export const menu = { title: "Menú" };\n');
    await writeInCopy(second.work, 'src/space/pages/about.ts', 'export const about = { title: "Sobre" };\n');
    await completeTask(first.ctx, runId, 't-menu');
    await completeTask(second.ctx, runId, 't-about');
    await reviewTask(lead(), runId, 't-menu', 'approve', []);

    const refused = await refusal(reviewTask(lead(), runId, 't-about', 'approve', []));
    expect(refused.code).toBe('conflict');
    expect(refused.message).toContain('src/space/lib/money.ts (task "t-menu" made one by that name too');
  });
});

describe('a shared file, by turns', () => {
  it('goes to one of two tasks completing at once: the other requests its change', async () => {
    const runId = await open();
    const first = await take('agent-1', 't-menu');
    const second = await take('agent-2', 't-about');
    for (const held of [first, second]) {
      await writeInCopy(
        held.work,
        'src/space/tokens.ts',
        `export const tokens = { ink: '#222', by: '${held.token}' };\n`
      );
    }

    await writeInCopy(first.work, 'src/space/pages/menu.ts', 'export const menu = { title: "Menú" };\n');
    await writeInCopy(second.work, 'src/space/pages/about.ts', 'export const about = { title: "Sobre" };\n');
    const both = await Promise.all([
      completeTask(first.ctx, runId, 't-menu'),
      completeTask(second.ctx, runId, 't-about')
    ]);

    expect(both.flatMap(each => each.claimed)).toEqual(['src/space/tokens.ts']);
    expect(both.flatMap(each => each.requests.map(request => request.file))).toEqual(['src/space/tokens.ts']);
  });
});

describe('a copy, as an agent can leave it', () => {
  it('says a copy that is gone as gone — not as another task’s files changed', async () => {
    const runId = await open();
    const held = await take('agent-1', 't-menu');
    await fs.rm(held.work, { recursive: true, force: true });

    const refused = await refusal(completeTask(held.ctx, runId, 't-menu'));
    expect(refused.code).toBe('invalid');
    expect(refused.message).toContain('copy is gone');
    expect(refused.message).toContain('plitzi task take t-menu');
  });

  it('refuses a file of the task turned into a link — what it points at would go to review as the file', async () => {
    await bench.write('.env', 'PLITZI_SECRET=hunter2\n');
    const runId = await open();
    const held = await take('agent-1', 't-menu');
    await fs.rm(path.join(held.work, 'src/space/pages/menu.ts'));
    await fs.symlink(path.join(bench.root, '.env'), path.join(held.work, 'src/space/pages/menu.ts'));

    const refused = await refusal(completeTask(held.ctx, runId, 't-menu'));
    expect(refused.message).toContain('into a link');
  });
});

describe('a token, said as what it is', () => {
  it('tells a token a task was cut from apart from one it was never taken with', async () => {
    const runId = await open();
    const held = await take('agent-1', 't-menu');
    const other = await take('agent-2', 't-about');
    const foreign = `${runId}.t-menu.${other.token.split('.').at(-1) ?? ''}`;

    const never = await refusal(reportProgress(bench.agent('agent-3', { token: foreign }), runId, 't-menu', {}));
    expect(never).toMatchObject({ code: 'invalid' });
    expect(never.message).toContain('not one task "t-menu" was taken with');

    await reassignTask(lead(), runId, 't-menu');
    expect((await refusal(reportProgress(held.ctx, runId, 't-menu', {}))).code).toBe('reassigned');
  });
});

describe('a UI review, by the team’s designers', () => {
  beforeEach(async () => {
    await setTeamAgent(bench.root, 'dev', { roles: ['developer'], count: 2 });
    await setTeamAgent(bench.root, 'design', { roles: ['designer'] });
    await openRun(lead(), await bench.writePlan(benchPlan()));
  });

  const inReview = async (): Promise<void> => {
    const held = await take('dev-1', 't-menu');
    await writeInCopy(held.work, 'src/space/pages/menu.ts', 'export const menu = { title: "Menú" };\n');
    await completeTask(held.ctx, 'es-launch', 't-menu');
  };

  it('refuses an agent the team does not name as a designer', async () => {
    await inReview();
    const refused = await refusal(reviewTask(bench.agent('dev-2'), 'es-launch', 't-menu', 'approve', []));
    expect(refused.message).toContain('dev-2 is no designer of the team');
    expect(refused.message).toContain('design-1');

    const stranger = await refusal(reviewTask(bench.agent('chaos'), 'es-launch', 't-menu', 'approve', []));
    expect(stranger.message).toContain('chaos is no designer');
  });

  it('counts the designer’s rounds and the lead’s apart: a person sees it after three of one kind', async () => {
    const held = await take('dev-1', 't-menu');
    const again = async (text: string): Promise<void> => {
      await writeInCopy(held.work, 'src/space/pages/menu.ts', `export const menu = { title: "${text}" };\n`);
      await completeTask(held.ctx, 'es-launch', 't-menu');
    };
    const designer = async (): Promise<unknown> => {
      await takeNext(bench.agent('design-1'), 'es-launch', 'designer');

      return reviewTask(bench.agent('design-1'), 'es-launch', 't-menu', 'changes', [{ note: 'Tighter at 390' }]);
    };

    await again('Menú 1');
    await designer();
    await again('Menú 2');
    await designer();
    await again('Menú 3');
    await takeNext(bench.agent('design-1'), 'es-launch', 'designer');
    await reviewTask(bench.agent('design-1'), 'es-launch', 't-menu', 'approve', []);
    expect(await reviewTask(lead(), 'es-launch', 't-menu', 'changes', [{ note: 'One' }])).toMatchObject({
      toPerson: false
    });
    await again('Menú 4');
    await takeNext(bench.agent('design-1'), 'es-launch', 'designer');
    await reviewTask(bench.agent('design-1'), 'es-launch', 't-menu', 'approve', []);
    expect(await reviewTask(lead(), 'es-launch', 't-menu', 'changes', [{ note: 'Two' }])).toMatchObject({
      toPerson: false
    });
    await again('Menú 5');
    await takeNext(bench.agent('design-1'), 'es-launch', 'designer');
    await reviewTask(bench.agent('design-1'), 'es-launch', 't-menu', 'approve', []);
    expect(await reviewTask(lead(), 'es-launch', 't-menu', 'changes', [{ note: 'Three' }])).toMatchObject({
      toPerson: true
    });
  });

  it('keeps --skip-design the lead’s, and says how the lead runs it', async () => {
    await inReview();
    await takeNext(bench.agent('design-1'), 'es-launch', 'designer');
    const refused = await refusal(
      reviewTask(bench.agent('design-1'), 'es-launch', 't-menu', 'approve', [], 'refuse', { skipDesign: true })
    );
    expect(refused.message).toContain('--skip-design is a lead');
    expect(refused.message).toContain('--agent lead');

    expect(
      await reviewTask(lead(), 'es-launch', 't-menu', 'approve', [], 'refuse', { skipDesign: true })
    ).toMatchObject({ verdict: 'approve', design: 'skipped' });
  });
});

describe('a plan, held to what a task can write', () => {
  const problemsOf = async (files: string[][]): Promise<string[]> => {
    const plan = benchPlan();
    plan.tasks = files.map((each, index) => ({ ...benchPlan().tasks[index], files: each, dependsOn: [] }));
    try {
      await checkPlan(bench.root, plan, await readOwnership(bench.root), teamFor(plan, 3));
    } catch (error) {
      if (error instanceof PlanRefusal) {
        return error.problems;
      }

      throw error;
    }

    return [];
  };

  it('refuses a pattern, a link, and two paths that differ only in case', async () => {
    await fs.symlink('/etc/hosts', path.join(bench.root, 'src/hosts.ts'));
    expect(await problemsOf([['src/space/pages/*.ts']])).toContainEqual(expect.stringContaining('is a pattern'));
    expect(await problemsOf([['src/hosts.ts']])).toContainEqual(expect.stringContaining('is a link (to /etc/hosts)'));
    expect(await problemsOf([['src/space/pages/menu.ts'], ['src/space/pages/MENU.ts']])).toContainEqual(
      expect.stringContaining('differ only in case')
    );
  });

  it('says a task with no acceptance, and each field of a plan that is not one', async () => {
    const plan = benchPlan();
    plan.tasks = [{ ...plan.tasks[3], acceptance: [] }];
    const checked = await checkPlan(bench.root, plan, await readOwnership(bench.root), teamFor(plan, 1));
    expect(checked.notices).toContainEqual(expect.stringContaining('says no acceptance'));

    const broken = { ...benchPlan(), tasks: [{ ...benchPlan().tasks[0], priority: 'urgent!!' }] };
    const file = path.join(bench.root, 'broken.plan.json');
    await fs.writeFile(file, JSON.stringify(broken));
    const refused = await refusal(checkPlanFile(lead(), file));
    expect(refused.message).toContain('tasks[0] ("t-home").priority: critical, high, medium, low, not "urgent!!"');
  });
});

describe('the checks of one result, run once', () => {
  it('reuses the dry run’s pass at the finish, said — and runs them again for another result', async () => {
    const runId = await open();
    await doTask('agent-1', 't-about', 'src/space/pages/about.ts', 'export const about = { title: "Sobre" };\n');
    const before = bench.checked.length;

    const dry = await finishRun(lead(), runId, { apply: false, leavePending: true });
    expect(dry.plan.checks?.reused).toBeUndefined();
    const applied = await finishRun(bench.person(), runId, { apply: true, leavePending: true });
    expect(applied.plan.checks?.reused).toBeDefined();
    expect(bench.checked.length - before).toBe(1);
    expect(await fs.stat(runPaths(bench.root, runId).dir).catch(() => undefined)).toBeUndefined();
  });
});

describe('what the lead handed the run', () => {
  it('goes with it — the plan, its primer, an amendment — and the folder that held only them', async () => {
    const plan = { ...benchPlan(), designReview: false, primer: 'primer.md' };
    await bench.write('tmp/v1/primer.md', '# What a task needs\n');
    await bench.write('tmp/v1/plan.json', JSON.stringify(plan));
    await bench.writeTeam(teamFor(plan, 4));
    await openRun(lead(), path.join(bench.root, 'tmp/v1/plan.json'));

    const amended = {
      ...plan,
      tasks: plan.tasks.map(task => (task.id === 't-about' ? { ...task, title: 'Translate the about page' } : task))
    };
    await bench.write('tmp/v1/plan.json', JSON.stringify(amended));
    await amendRun(lead(), plan.runId, path.join(bench.root, 'tmp/v1/plan.json'));
    await doTask('agent-1', 't-about', 'src/space/pages/about.ts', 'export const about = { title: "Sobre" };\n');
    await bench.write('tmp/v1/summary.md', '# Done\n');
    await writeSummary(lead(), plan.runId, 'tmp/v1/summary.md');

    const finished = await finishRun(bench.person(), plan.runId, { apply: true, leavePending: true });
    expect(finished.inputs?.removed.sort()).toEqual(['tmp/v1/plan.json', 'tmp/v1/primer.md', 'tmp/v1/summary.md']);
    expect(await fs.stat(path.join(bench.root, 'tmp/v1')).catch(() => undefined)).toBeUndefined();
    expect(await fs.stat(path.join(bench.root, 'tmp')).catch(() => undefined)).toBeDefined();
  });
});

describe('what the lead reads', () => {
  it('cuts a message too long to scan in the run’s view, and says where it is whole', async () => {
    const runId = await open();
    const held = await take('agent-1', 't-menu');
    await tellLead(held.ctx, runId, 't-menu', 'lorem ipsum '.repeat(500));

    const [said] = (await viewRun(lead(), runId)).attention.filter(item => item.kind === 'message');
    expect(said.text.length).toBeLessThan(700);
    expect(said.text).toContain('characters more in the inbox');
  });

  it('says a developer task that gets no task of tests, and why', async () => {
    const plan = benchPlan();
    plan.tasks = [{ ...plan.tasks[0], id: 't-theme', files: ['src/space/theme.ts'] }];
    const team = {
      version: 1 as const,
      agents: [
        { name: 'dev', roles: ['developer'] },
        { name: 'test', roles: ['tester'] }
      ]
    };
    const checked = await checkPlan(bench.root, plan, await readOwnership(bench.root), team);

    expect(checked.notices).toContainEqual(expect.stringContaining('"t-theme" gets no task of tests'));
  });
});

describe('an agreement waiting on another task', () => {
  it('is said to the task that accepted it once the task it agreed with is approved', async () => {
    const runId = await open();
    const menu = await take('agent-1', 't-menu');
    const about = await take('agent-2', 't-about');
    const proposed = await proposeChange(menu.ctx, runId, 't-menu', 't-about', {
      change: 'Link the menu from the about page',
      wait: false
    });
    await answerProposal(about.ctx, runId, proposed.proposal.id, { verdict: 'accept' });
    await writeInCopy(menu.work, 'src/space/pages/menu.ts', 'export const menu = { title: "Menú" };\n');
    await completeTask(menu.ctx, runId, 't-menu');
    await reviewTask(lead(), runId, 't-menu', 'approve', []);

    const told = await readInbox(about.ctx, runId, 't-about');
    expect(told.map(message => message.text)).toContainEqual(
      expect.stringContaining('t-menu is approved: what you agreed with it')
    );
  });
});

describe('one answer about a file, whoever asks', () => {
  it('says a file of a task not taken yet is that task’s to an agent — and to a person, who it will be', async () => {
    const runId = await open();
    const held = await take('agent-1', 't-menu');

    expect(await canWrite(held.ctx, 'src/space/pages/about.ts', 't-menu')).toMatchObject({
      ok: false,
      plannedFor: { run: runId, task: 't-about' }
    });
    expect(await canWrite(bench.person(), 'src/space/pages/about.ts')).toMatchObject({
      ok: true,
      plannedFor: { task: 't-about' }
    });
    expect(
      (
        await refusal(
          requestShared(held.ctx, runId, 't-menu', 'src/space/pages/about.ts', {
            summary: 'A link',
            usedIn: [],
            blocking: false
          })
        )
      ).message
    ).toContain('plitzi task propose t-about');
  });

  it('answers a sign of life of a task in review as one in review, not with when it may be reassigned', async () => {
    const runId = await open();
    const held = await take('agent-1', 't-menu');
    await writeInCopy(held.work, 'src/space/pages/menu.ts', 'export const menu = { title: "Menú" };\n');
    await completeTask(held.ctx, runId, 't-menu');

    expect(await reportProgress(held.ctx, runId, 't-menu', {})).toMatchObject({ inReview: true });
  });
});

describe('a designer’s own work', () => {
  it('asks it no UI review when no other designer of the team could give it — the lead reviews it', async () => {
    await setTeamAgent(bench.root, 'design', { roles: ['designer', 'reviewer'] });
    const plan = { ...benchPlan(), designReview: true };
    plan.tasks = [{ ...plan.tasks[3], role: 'reviewer' }];
    await openRun(lead(), await bench.writePlan(plan));
    const held = await take('design-1', 't-about');
    await writeInCopy(held.work, 'src/space/pages/about.ts', 'export const about = { title: "Sobre" };\n');
    await completeTask(held.ctx, 'es-launch', 't-about');

    expect(await reviewTask(lead(), 'es-launch', 't-about', 'approve', [])).toMatchObject({ verdict: 'approve' });
  });
});

describe('what a task was accepted on, at the finish', () => {
  it('is checked again on the whole result: a later task that broke it stops the finish, naming both', async () => {
    const plan = benchPlan();
    plan.tasks = [
      { ...plan.tasks[1], acceptance: [{ said: 'No page is late', check: 'test ! -f src/space/pages/late.ts' }] },
      { ...plan.tasks[3], dependsOn: [] }
    ];
    const runId = await open(plan);
    await doTask('agent-1', 't-menu', 'src/space/pages/menu.ts', 'export const menu = { title: "Menú" };\n');
    const later = await take('agent-2', 't-about');
    await writeInCopy(later.work, 'src/space/pages/about.ts', 'export const about = { title: "Sobre" };\n');
    await writeInCopy(later.work, 'src/space/pages/late.ts', 'export const late = 1;\n');
    await completeTask(later.ctx, runId, 't-about');
    await reviewTask(lead(), runId, 't-about', 'approve', []);

    const refused = await refusal(finishRun(lead(), runId, { apply: false, leavePending: true }));
    expect(refused.code).toBe('checks-failed');
    expect(refused.message).toContain('"t-menu" was accepted on no longer holds');
    expect(refused.message).toContain('No page is late');
  });
});
