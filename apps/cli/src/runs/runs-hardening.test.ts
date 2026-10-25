import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { amendRun } from './amend';
import { FIRST_REVIEW_READING_MS, REVIEW_TIMEOUT_MS } from './design';
import { finishRun } from './merge';
import { readOwnership } from './ownership';
import { runPaths } from './paths';
import { checkPlan, PlanRefusal } from './plan';
import { answerProposal, proposeChange } from './proposals';
import { writeSummary } from './report';
import { checkPlanFile, openRun } from './run';
import { messageTasks, tellLead } from './talk';
import { readInbox } from './talk';
import {
  canWrite,
  checkTask,
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
import { LEAD_SAID, runSteps } from '../tests/runSteps';

import type { Bench } from '../tests/runProject';

/** What an agent can do around the rules — after its review, by a link, under another's name — and what holds. */

let bench: Bench;

beforeEach(async () => {
  bench = await makeBench();
});

afterEach(async () => {
  await bench.cleanup();
});

const { refusal, lead, open, take, doTask, looked } = runSteps(() => bench);

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

describe('a shared file both a task and the run changed', () => {
  // T-sponsors' theme.ts lacked the token the run's newly approved header read, and author failed in its
  // copy — the two were only put together at complete.
  it('is put together in the copy as it is brought up to the run: its checks run on both changes', async () => {
    const runId = await open();
    const menu = await take('agent-1', 't-menu');
    const about = await take('agent-2', 't-about');
    const theme = await fs.readFile(path.join(bench.root, 'src/space/theme.ts'), 'utf-8');
    await writeInCopy(about.work, 'src/space/theme.ts', `// The about page's tokens too.\n${theme}`);
    await writeInCopy(menu.work, 'src/space/theme.ts', `${theme}export const menuHalo = '#c7a86b';\n`);
    await writeInCopy(menu.work, 'src/space/pages/menu.ts', 'export const menu = { title: "Menú" };\n');
    await completeTask(menu.ctx, runId, 't-menu');
    await reviewTask(lead(), runId, 't-menu', 'approve', []);

    await checkTask(about.ctx, runId, 't-about');
    const merged = await fs.readFile(path.join(about.work, 'src/space/theme.ts'), 'utf-8');
    expect(merged).toContain("// The about page's tokens too.");
    expect(merged).toContain("export const menuHalo = '#c7a86b';");
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

  it('counts the designer’s rounds and the lead’s apart: the lead decides after three of one kind', async () => {
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
      toLead: false
    });
    await again('Menú 4');
    await takeNext(bench.agent('design-1'), 'es-launch', 'designer');
    await reviewTask(bench.agent('design-1'), 'es-launch', 't-menu', 'approve', []);
    expect(await reviewTask(lead(), 'es-launch', 't-menu', 'changes', [{ note: 'Two' }])).toMatchObject({
      toLead: false
    });
    await again('Menú 5');
    await takeNext(bench.agent('design-1'), 'es-launch', 'designer');
    await reviewTask(bench.agent('design-1'), 'es-launch', 't-menu', 'approve', []);
    expect(await reviewTask(lead(), 'es-launch', 't-menu', 'changes', [{ note: 'Three' }])).toMatchObject({
      toLead: true
    });
  });

  // Design-1's round went out before the lead's "only the bars this round" reached it.
  it('hands a designer what the lead said while it reviewed, before its verdict goes', async () => {
    await inReview();
    await takeNext(bench.agent('design-1'), 'es-launch', 'designer');
    await messageTasks(lead(), 'es-launch', '@design-1', 'Only the title this round');

    const first = await refusal(
      reviewTask(bench.agent('design-1'), 'es-launch', 't-menu', 'changes', [{ note: 'Tighter at 390' }])
    );
    expect(first.message).toContain('Only the title this round');
    // Read now: said again, the verdict goes.
    expect(
      await reviewTask(bench.agent('design-1'), 'es-launch', 't-menu', 'approve', [{ note: 'The title holds' }])
    ).toMatchObject({ design: 'approved' });
  });

  it('keeps --skip-design the lead’s, and says how the lead runs it', async () => {
    await inReview();
    await takeNext(bench.agent('design-1'), 'es-launch', 'designer');
    const refused = await refusal(
      reviewTask(bench.agent('design-1'), 'es-launch', 't-menu', 'approve', [], 'refuse', { skipDesign: 'lead' })
    );
    expect(refused.message).toContain('--skip-design is a lead');
    expect(refused.message).toContain('--approve --skip-design lead');
    // A hint that says --token contradicts the agent's own CLI, which says who it is: none says it.
    expect(refused.message).not.toContain('--token');

    // design-1's review in its time is design-1's: past it — its first, which holds its reading — the lead's.
    bench.advance(REVIEW_TIMEOUT_MS + FIRST_REVIEW_READING_MS + 60_000);
    // The lead approved a UI it never looked at; its review of the UI is a look, said before the approval.
    expect(
      (await refusal(reviewTask(lead(), 'es-launch', 't-menu', 'approve', [], 'refuse', { skipDesign: 'lead' })))
        .message
    ).toContain('plitzi task look t-menu');
    await looked('t-menu');
    expect(
      await reviewTask(lead(), 'es-launch', 't-menu', 'approve', [], 'refuse', { skipDesign: 'lead' })
    ).toMatchObject({ verdict: 'approve', design: 'skipped', designSkip: 'lead' });
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

describe('the checks of one result, kept for the day', () => {
  // The finish ran its checks again two hours after its dry run, on the very same result — an hour was no
  // unit a check reads; a day is.
  it('reuses a pass hours later the same day, and runs it again the next', async () => {
    const runId = await open();
    await doTask('agent-1', 't-about', 'src/space/pages/about.ts', 'export const about = { title: "Sobre" };\n');
    await finishRun(lead(), runId, { apply: false, leavePending: true });
    const now = bench.now();
    const midnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);

    // Later the same day: as before, not run again — wherever in the day the test runs.
    bench.advance(Math.max(0, Math.min(2 * 60 * 60_000, midnight - now.getTime() - 60_000)));
    expect((await finishRun(lead(), runId, { apply: false, leavePending: true })).plan.checks?.reused).toBeDefined();

    // The next day: run again — a check may read the day.
    bench.advance(midnight - bench.now().getTime() + 60_000);
    expect((await finishRun(lead(), runId, { apply: false, leavePending: true })).plan.checks?.reused).toBeUndefined();
  });
});

describe('the checks of a result once Plitzi changed', () => {
  // A run's upgrade put new code under the same 0.38.24: its finish said the checks of "this same result, not run
  // again" — run by the Plitzi it had replaced.
  it('runs them again when the installed Plitzi was written again, whatever its version says', async () => {
    const manifest = path.join(bench.root, 'node_modules', '@plitzi', 'sdk-authoring', 'package.json');
    await fs.mkdir(path.dirname(manifest), { recursive: true });
    await fs.writeFile(manifest, JSON.stringify({ name: '@plitzi/sdk-authoring', version: '0.38.24' }));
    const runId = await open();
    await doTask('agent-1', 't-about', 'src/space/pages/about.ts', 'export const about = { title: "Sobre" };\n');
    const before = bench.checked.length;

    await finishRun(lead(), runId, { apply: false, leavePending: true });
    const later = new Date(Date.now() + 60_000);
    await fs.utimes(manifest, later, later);
    const again = await finishRun(lead(), runId, { apply: false, leavePending: true });

    expect(again.plan.checks?.reused).toBeUndefined();
    expect(bench.checked.length - before).toBe(2);
  });
});

describe('what the lead handed the run', () => {
  // A run's 9.7 KB primer put all 19 first briefs over 12k characters, each read again on every turn after.
  it('says a primer heavy enough to outweigh a task’s own brief, with what it costs the run', async () => {
    const plan = { ...benchPlan(), designReview: false, primer: 'primer.md' };
    await bench.write('tmp/v1/plan.json', JSON.stringify(plan));
    await bench.writeTeam(teamFor(plan, 4));
    await bench.write('tmp/v1/primer.md', `# What a task needs\n${'A rule of the project, said once.\n'.repeat(60)}`);
    expect((await checkPlanFile(lead(), path.join(bench.root, 'tmp/v1/plan.json'))).notices).not.toContainEqual(
      expect.stringContaining('The primer is')
    );

    await bench.write('tmp/v1/primer.md', `# What a task needs\n${'A rule of the project, said once.\n'.repeat(220)}`);
    expect((await checkPlanFile(lead(), path.join(bench.root, 'tmp/v1/plan.json'))).notices).toContainEqual(
      expect.stringMatching(/^The primer is 7\.\d KB: every task's first brief carries it whole — \d+ tasks read/)
    );
  });

  it('takes the plan and its primer into its folder, where the lead amends them — and removes what it was handed after', async () => {
    const plan = { ...benchPlan(), designReview: false, primer: 'primer.md' };
    await bench.write('tmp/v1/primer.md', '# What a task needs\n');
    await bench.write('tmp/v1/plan.json', JSON.stringify(plan));
    await bench.writeTeam(teamFor(plan, 4));
    const opened = await openRun(lead(), path.join(bench.root, 'tmp/v1/plan.json'));
    // The run's now: in its folder, and nothing of it left in the project's tmp/.
    const inputs = path.join(runPaths(bench.root, plan.runId).dir, 'inputs');
    expect(opened.inputs).toEqual([path.join(inputs, 'plan.json'), path.join(inputs, 'primer.md')]);
    expect(await fs.stat(path.join(bench.root, 'tmp/v1')).catch(() => undefined)).toBeUndefined();

    const amended = {
      ...plan,
      tasks: plan.tasks.map(task => (task.id === 't-about' ? { ...task, title: 'Translate the about page' } : task))
    };
    await fs.writeFile(path.join(inputs, 'plan.json'), JSON.stringify(amended));
    expect(await amendRun(lead(), plan.runId, path.join(inputs, 'plan.json'))).toMatchObject({
      tasks: [{ task: 't-about', changed: ['title'] }]
    });
    await doTask('agent-1', 't-about', 'src/space/pages/about.ts', 'export const about = { title: "Sobre" };\n');
    await bench.write('tmp/v1/summary.md', '# Done\n');
    await writeSummary(lead(), plan.runId, 'tmp/v1/summary.md', LEAD_SAID);

    const finished = await finishRun(bench.person(), plan.runId, { apply: true, leavePending: true });
    expect(finished.inputs?.removed).toEqual(['tmp/v1/summary.md']);
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

  it('runs again only the lines that did not hold: one a host was slow on never runs the rest once more', async () => {
    // Outside the project: a file the checks write in it would change the result they are kept for.
    const outside = await fs.mkdtemp(path.join(os.tmpdir(), 'plitzi-kept-'));
    const counted = path.join(outside, 'menu-checked.txt');
    const flag = path.join(outside, 'about-ready.txt');
    const plan = benchPlan();
    plan.tasks = [
      { ...plan.tasks[1], acceptance: [{ said: 'Menu checked', check: `echo x >> '${counted}'` }] },
      { ...plan.tasks[3], dependsOn: [], acceptance: [{ said: 'About ready', check: `test -f '${flag}'` }] }
    ];
    const runId = await open(plan);
    await doTask('agent-1', 't-menu', 'src/space/pages/menu.ts', 'export const menu = { title: "Menú" };\n');
    await fs.writeFile(flag, 'ready\n');
    await doTask('agent-2', 't-about', 'src/space/pages/about.ts', 'export const about = { title: "Sobre" };\n');
    // Gone at the finish, as a host is slow for a moment: the line fails there, and holds again once it is back.
    await fs.rm(flag);
    const ranAtReview = (await fs.readFile(counted, 'utf-8')).split('\n').filter(Boolean).length;

    expect((await refusal(finishRun(lead(), runId, { apply: false, leavePending: true }))).code).toBe('checks-failed');
    await fs.writeFile(flag, 'ready\n');
    const dry = await finishRun(lead(), runId, { apply: false, leavePending: true });

    expect(dry.plan.acceptance).toMatchObject({ kept: 1 });
    expect((await fs.readFile(counted, 'utf-8')).split('\n').filter(Boolean).length - ranAtReview).toBe(1);
    await fs.rm(outside, { recursive: true, force: true });
  });

  // A `--compare` measures against the reference kept: kept again, a pass against the old one says nothing of the new.
  it('runs every line again once the reference was kept again', async () => {
    const outside = await fs.mkdtemp(path.join(os.tmpdir(), 'plitzi-kept-'));
    const counted = path.join(outside, 'menu-checked.txt');
    const plan = benchPlan();
    plan.tasks = [{ ...plan.tasks[1], acceptance: [{ said: 'Menu checked', check: `echo x >> '${counted}'` }] }];
    const runId = await open(plan);
    await doTask('agent-1', 't-menu', 'src/space/pages/menu.ts', 'export const menu = { title: "Menú" };\n');
    await finishRun(lead(), runId, { apply: false, leavePending: true });
    const ran = (await fs.readFile(counted, 'utf-8')).split('\n').filter(Boolean).length;

    expect(
      (await finishRun(lead(), runId, { apply: false, leavePending: true })).plan.acceptance?.reused
    ).toBeDefined();
    const reference = runPaths(bench.root, runId).reference;
    await fs.mkdir(reference, { recursive: true });
    await fs.writeFile(path.join(reference, 'menu-1440-dark.json'), '{}\n');
    expect(
      (await finishRun(lead(), runId, { apply: false, leavePending: true })).plan.acceptance?.reused
    ).toBeUndefined();
    expect((await fs.readFile(counted, 'utf-8')).split('\n').filter(Boolean).length - ran).toBe(1);
    await fs.rm(outside, { recursive: true, force: true });
  });
});
