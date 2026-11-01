import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { amendRun } from './amend';
import { seeStage } from './extend';
import { stageImpact } from './stageImpact';
import { benchPlan, makeBench } from '../../tests/runProject';
import { runSteps } from '../../tests/runSteps';
import { loadRun } from '../run';

import type { RunTaskNow } from './stageImpact';
import type { Bench } from '../../tests/runProject';
import type { TaskStatus } from '../core/model';

// Carlos: a change the person asks mid-run lands on what the run has — the lead plans for it before, never at complete.
const task = (
  id: string,
  status: TaskStatus,
  files: string[],
  more: Partial<RunTaskNow['task']> = {},
  agent?: string
) => ({
  task: { id, files, dependsOn: [], acceptance: [], ...more },
  status,
  ...(agent === undefined ? {} : { agent })
});

describe('what a stage reaches of the run', () => {
  const run: RunTaskNow[] = [
    task('t-header', 'done', ['src/space/header.ts', 'src/space/header.test.ts']),
    task('t-home', 'in-progress', ['src/space/pages/home.ts'], {}, 'dev-1'),
    task('t-about', 'ready', ['src/space/pages/about.ts']),
    task('t-menu', 'in-review', ['src/space/pages/menu.ts'], { touches: ['src/space/header.ts'] }),
    task('t-blog', 'pending', ['src/space/pages/blog.ts'])
  ];
  // Home and about import the header; the header's own test, and the project's site test through home.
  const importedBy = new Map([
    ['src/space/header.ts', ['src/space/pages/home.ts', 'src/space/pages/about.ts']],
    ['src/space/pages/home.ts', ['src/space/index.ts']]
  ]);
  const testsOf = new Map([
    ['src/space/header.ts', ['src/space/header.test.ts']],
    ['src/space/index.ts', ['src/space/site.test.ts']]
  ]);

  it('says each task reached with what to do by where it stands, and the tests that will run against it', () => {
    const [notice, ...more] = stageImpact({
      stage: [{ id: 't-header-dark', files: ['src/space/header.ts'], dependsOn: [] }],
      run,
      importedBy,
      testsOf
    });

    expect(more).toEqual([]);
    expect(notice).toContain('t-header-dark changes what the run has already');
    expect(notice).toContain('t-header wrote src/space/header.ts — approved: its acceptance runs again at the finish');
    expect(notice).toContain(
      't-home\'s src/space/pages/home.ts use what it changes — at work with dev-1: tell it what changes (plitzi task message t-home "…")'
    );
    expect(notice).toContain("t-about's src/space/pages/about.ts use what it changes — not taken: amend it");
    expect(notice).toContain("t-menu's src/space/header.ts use what it changes — in review: amend its acceptance");
    expect(notice).toContain(
      "tests src/space/header.test.ts, src/space/site.test.ts (t-header's, approved; the project's) import what it changes"
    );
    // Nothing of it reaches the blog page.
    expect(notice).not.toContain('t-blog');
  });

  it('says nothing for work that reaches none of the run’s, nor for a task of tests', () => {
    expect(
      stageImpact({
        stage: [
          { id: 't-contact', files: ['src/space/pages/contact.ts'], dependsOn: [] },
          {
            id: 't-contact-tests',
            files: ['src/space/header.test.ts'],
            dependsOn: ['t-contact'],
            testsOf: ['t-contact']
          }
        ],
        run,
        importedBy,
        testsOf
      })
    ).toEqual([]);
  });

  it('leaves out the tests the stage writes itself', () => {
    const [notice] = stageImpact({
      stage: [
        { id: 't-header-dark', files: ['src/space/header.ts'], dependsOn: [] },
        { id: 't-header-dark-tests', files: ['src/space/header.test.ts'], dependsOn: [], testsOf: ['t-header-dark'] }
      ],
      run,
      importedBy,
      testsOf
    });

    expect(notice).toContain("tests src/space/site.test.ts (the project's)");
  });
});

describe('a stage over approved work, seen before it is stacked', () => {
  let bench: Bench;

  beforeEach(async () => {
    bench = await makeBench();
  });

  afterEach(async () => {
    await bench.cleanup();
  });

  const { doTask, lead, open } = runSteps(() => bench);

  it('says the approved task it rewrites at run open --dry-run, with what to do', async () => {
    const runId = await open(benchPlan());
    await doTask('agent-1', 't-about', 'src/space/pages/about.ts', 'export const about = { title: "Sobre" };\n');
    const stage = {
      version: 1 as const,
      runId: 'es-launch-2',
      goal: 'The about page, as the person asked again',
      tasks: [
        {
          id: 't-about-again',
          title: 'About, with the team',
          files: ['src/space/pages/about.ts'],
          dependsOn: [],
          priority: 'medium' as const,
          estimateMinutes: 10,
          acceptance: ['It names the team']
        }
      ]
    };
    const seen = await seeStage(lead(), runId, await bench.writePlan(stage));

    expect(seen.checked?.notices.join('\n')).toContain(
      't-about-again changes what the run has already — plan each now, or its complete and the finish meet it:\n    · t-about wrote src/space/pages/about.ts — approved: its acceptance runs again at the finish'
    );
  }, 30_000);

  // The other way in: an amendment that asks a task at work or to come something new.
  it('says what an amendment reaches at run amend --dry-run, writing nothing — and again as it is written', async () => {
    const plan = benchPlan();
    const runId = await open(plan);
    await doTask(
      'agent-1',
      't-about',
      'src/space/pages/about.ts',
      "import { home } from './home/index.ts';\nexport const about = { title: 'Sobre', home };\n"
    );
    const asked = {
      ...plan,
      tasks: plan.tasks.map(task =>
        task.id === 't-home' ? { ...task, acceptance: ['The home greets in Spanish'] } : task
      )
    };
    const file = await bench.writePlan(asked);
    const reach =
      "t-home changes what the run has already — plan each now, or its complete and the finish meet it:\n    · t-about's src/space/pages/about.ts use what it changes — approved";

    const seen = await amendRun(lead(), runId, file, { dryRun: true });
    expect(seen).toMatchObject({ dryRun: true, tasks: [{ task: 't-home', changed: ['acceptance'] }] });
    expect(seen.impact?.join('\n')).toContain(reach);
    // Nothing written: the run still asks what it did.
    expect((await loadRun(lead(), runId)).plan.tasks.find(task => task.id === 't-home')?.acceptance).toEqual(
      plan.tasks.find(task => task.id === 't-home')?.acceptance
    );

    const amended = await amendRun(lead(), runId, file);
    expect(amended.dryRun).toBeUndefined();
    expect(amended.impact?.join('\n')).toContain(reach);
    expect((await loadRun(lead(), runId)).plan.tasks.find(task => task.id === 't-home')?.acceptance).toEqual([
      'The home greets in Spanish'
    ]);
  }, 30_000);
});
