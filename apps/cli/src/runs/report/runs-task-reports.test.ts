import fs from 'node:fs/promises';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { feedbackFile, feedbackOf, writeFeedback } from './feedback';
import { keepScratch } from '../findings';
import { buildReport, reportBrief, reportText } from './report';
import { withoutMachine } from './reports';
import { makeBench, writeInCopy } from '../../tests/runProject';
import { LEAD_SAID, runSteps } from '../../tests/runSteps';
import { loadRun } from '../run';
import { readTaskReports } from './taskReports';
import { checkTask, completeTask, reviewTask } from '../tasks';

import type { Bench } from '../../tests/runProject';
import type { CheckRunner } from '../copies/checks';

/**
 * Each agent reports its round as it completes it; the lead's report and the run's feedback put them together — so the
 * lead keeps no list of problems by hand (a run's journal held 65).
 */

let bench: Bench;

beforeEach(async () => {
  bench = await makeBench();
});

afterEach(async () => {
  await bench.cleanup();
});

const { lead, open, take } = runSteps(() => bench);

describe('a round’s report, and the run’s', () => {
  it('keeps each round as its agent completed it, with its words, and the report and the feedback carry it', async () => {
    const runId = await open();
    const about = await take('agent-1', 't-about');
    await writeInCopy(about.work, 'src/space/pages/about.ts', 'export const about = { title: "Sobre" };\n');
    const experience = {
      ease: 2,
      hardest: 'Finding how a page names its share image',
      frictions: ['explain had no answer for a page’s share image'],
      helped: ['task check said each failing line']
    };
    const completed = await completeTask(about.ctx, runId, 't-about', { experience });

    expect(completed.report).toEqual({ round: 1, experience: true });
    const loaded = await loadRun(lead(), runId);
    const [round] = await readTaskReports(loaded);
    expect(round).toMatchObject({
      version: 1,
      task: 't-about',
      round: 1,
      agent: 'agent-1',
      experience,
      // `task check`s: the complete's own checks are its answer, a refused one in `refusals`.
      checks: { run: 0, failed: 0 },
      refusals: []
    });

    const report = await buildReport(lead(), loaded);
    expect(report.taskReports).toHaveLength(1);
    expect(reportText(report, undefined)).toContain('## Problems — whose, and what would stop them');
    // The title held every stage's goal, and the lead's summary's `#` sat above the report's own `##`.
    const staged = reportText({ ...report, goal: 'The run · A stage · Another' }, '# The summary\n\n## What it did');
    expect(staged).toContain(`# Run "${runId}" — The run\n\nIts stages, as they were stacked:\n\n- A stage\n- Another`);
    expect(staged).toContain('### The summary\n\n#### What it did');
    // What the command prints: the glance and each finding's title — a run's lead read 112k characters.
    const brief = reportBrief({ ...report, goal: 'The run · A stage' });
    expect(brief).toContain(`# Run "${runId}" — The run`);
    expect(brief).not.toContain('A stage');
    expect(brief).toContain('plitzi run report --full');
    expect(brief.length).toBeLessThan(reportText(report, undefined).length);

    // Combined with the lead's, said with its summary: the frictions are findings of Plitzi's too.
    const feedback = await feedbackOf(lead(), loaded);
    expect(feedback.experience).toMatchObject({
      ease: { median: 2, lowest: [{ agent: 'agent-1', task: 't-about', round: 1, ease: 2 }] },
      frictions: [
        {
          text: 'explain had no answer for a page’s share image',
          by: [{ agent: 'agent-1', task: 't-about', round: 1 }]
        }
      ],
      helped: [{ text: 'task check said each failing line' }],
      lead: LEAD_SAID
    });
    expect(feedback.findings.find(each => each.kind === 'said')?.title).toBe(
      'explain had no answer for a page’s share image'
    );
    expect(JSON.stringify(feedback)).not.toContain(bench.root);

    const file = await writeFeedback(lead(), loaded);
    expect(file).toBe(feedbackFile(bench.root, runId));
    expect(await fs.readFile(file, 'utf-8')).toContain(
      '- explain had no answer for a page’s share image — agent-1 at t-about'
    );
  });
});

describe('what a fix of Plitzi reads without running it again', () => {
  it('keeps why a check failed, what the review asked, and the agents’ scripts beside the report', async () => {
    const runId = await open();
    const about = await take('agent-1', 't-about');
    await writeInCopy(about.work, 'src/space/pages/about.ts', 'export const about = { title: "Sobre" };\n');
    const lintFails: CheckRunner = () =>
      Promise.resolve({
        ok: false,
        steps: [{ name: 'lint', ok: false, said: ['> eslint .', 'src/space/pages/about.ts:1 error no-unused-vars'] }]
      });
    await checkTask({ ...about.ctx, checks: lintFails }, runId, 't-about');
    await completeTask(about.ctx, runId, 't-about', { experience: LEAD_SAID });
    await reviewTask(lead(), runId, 't-about', 'changes', [{ note: 'The title says Sobre twice' }]);

    const loaded = await loadRun(lead(), runId);
    const [round] = await readTaskReports(loaded);
    expect(round.checks.why).toEqual([{ step: 'lint', said: ['src/space/pages/about.ts:1 error no-unused-vars'] }]);
    const report = await buildReport(lead(), loaded);
    expect(report.tasks.find(task => task.id === 't-about')?.reviews).toEqual([
      { round: 1, by: 'lead', asked: expect.stringContaining('The title says Sobre twice') as unknown }
    ]);

    const scratch = path.join(loaded.paths.scratch, 'agent-1', 'axe');
    await fs.mkdir(scratch, { recursive: true });
    await fs.writeFile(path.join(scratch, 'audit.mjs'), `console.log(${JSON.stringify(bench.root)});\n`);
    const into = path.join(bench.root, 'tmp', 'kept');
    expect(await keepScratch(loaded.paths.scratch, into, text => withoutMachine(bench.root, text))).toEqual({
      kept: ['agent-1/axe/audit.mjs'],
      tooLarge: []
    });
    expect(await fs.readFile(path.join(into, 'agent-1', 'axe', 'audit.mjs'), 'utf-8')).toBe(
      'console.log("<project>");\n'
    );
  });
});
