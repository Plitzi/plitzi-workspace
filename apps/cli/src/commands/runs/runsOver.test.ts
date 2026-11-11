import fs from 'node:fs/promises';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { runPaths } from '../../core/paths';
import { issueToken, leadCliOver } from '../../runs/agents/identity';
import { finishRun } from '../../runs/copies/merge';
import { feedbackFile } from '../../runs/report/feedback';
import { LEAD } from '../../runs/talk/messages';
import { plitzi } from '../../tests/plitziProcess';
import { benchPlan, makeBench } from '../../tests/runProject';
import { runSteps } from '../../tests/runSteps';

import type { Bench } from '../../tests/runProject';

let bench: Bench;

beforeEach(async () => {
  bench = await makeBench();
});

afterEach(async () => {
  await bench.cleanup();
});

const { doTask, open } = runSteps(() => bench);

// A run's lead found four things at the close and, through its own CLI kept past the run, was refused each notice:
// its token was checked against the run's folder, which the apply had removed.
describe('the lead’s own CLI, once the run is applied', () => {
  it('adds a notice to the report the run left, its token proved against the identities the report keeps', async () => {
    const runId = await open(benchPlan());
    // The lead's token, as `run open` makes it: what its own CLI passes, kept past the run by the apply.
    const issued = await issueToken(runPaths(bench.root, runId), runId, LEAD, bench.now());
    await doTask('agent-1', 't-about', 'src/space/pages/about.ts', 'export const about = { es: true };\n');
    await finishRun(bench.person(true), runId, { apply: true, leavePending: true });
    const token = (await fs.readFile(path.join(path.dirname(leadCliOver(bench.root, runId)), 'token'), 'utf-8')).trim();
    expect(token).toBe(issued?.token);

    const said = await plitzi(
      bench.root,
      ['run', 'notice', '--plitzi', 'wrong', 'the preview stopped during the close, with no word', '--run', runId],
      { PLITZI_TOKEN: token }
    );

    expect(said.code).toBe(0);
    expect(await fs.readFile(feedbackFile(bench.root, runId), 'utf-8')).toContain(
      'the preview stopped during the close, with no word'
    );
  }, 60_000);
});
