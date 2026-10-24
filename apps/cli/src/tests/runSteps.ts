import fs from 'node:fs/promises';

import { teamFor } from './runProject';
import { benchPlan, writeInCopy } from './runProject';
import { isRunRefusal } from '../runs/refusal';
import { writeSummary } from '../runs/report';
import { loadRun, logRun, openRun } from '../runs/run';
import { completeTask, reviewTask, takeTask } from '../runs/tasks';

import type { Bench } from './runProject';
import type { Experience } from '../runs/experience';
import type { RunPlan } from '../runs/model';
import type { RefusalCode } from '../runs/refusal';
import type { RunContext } from '../runs/run';

/** What a test's lead says it was like, closing a run whose report is not what the test is about. */
export const LEAD_SAID: Experience = { ease: 4, hardest: 'Writing the plan', frictions: [], helped: [] };

/**
 * The steps the run tests are written in, over the bench each test makes: refused as what, the lead, a run opened, a
 * task taken — and done, the whole round a subagent and its reviewer make.
 */

export interface Refused {
  code: RefusalCode;
  message: string;
  detail: unknown;
}

/** How `work` was refused — failing the test when it was not. */
export const refusal = async (work: Promise<unknown>): Promise<Refused> => {
  try {
    await work;
  } catch (error) {
    if (isRunRefusal(error)) {
      return { code: error.code, message: error.message, detail: error.detail };
    }

    throw error;
  }

  throw new Error('It was not refused');
};

/** A look at a task, as `task look` logs it — what a lead's UI review with `--skip-design lead` is. */
export const lookedAt = async (ctx: RunContext, runId: string, taskId: string): Promise<void> =>
  logRun(ctx, (await loadRun(ctx, runId)).paths, { action: 'look', task: taskId });

export const runSteps = (bench: () => Bench) => {
  const lead = (): RunContext => bench().agent('lead');

  /** Opens a plan's file with a team of `agents` that takes every role it names: as many at once as the test needs. */
  const openWith = async (
    ctx: RunContext,
    file: string,
    agents: number,
    options?: { leadFinishes?: boolean }
  ): ReturnType<typeof openRun> => {
    // The plan the test wrote itself, read back: its shape is the test's, not an input to check.
    await bench().writeTeam(teamFor(JSON.parse(await fs.readFile(file, 'utf-8')) as RunPlan, agents));

    return openRun(ctx, file, options);
  };

  /**
   * Opens the bench's plan as the lead — and writes the summary it closes the run with, which the final merge asks
   * for, unless a test is about that.
   */
  const open = async (plan = benchPlan(), { summary = true, agents = 4 } = {}): Promise<string> => {
    await openWith(lead(), await bench().writePlan({ ...plan, designReview: plan.designReview ?? false }), agents);
    if (summary) {
      await bench().write('summary.md', '# What the run did\n\nTranslated the pages; nothing left.\n');
      await writeSummary(lead(), plan.runId, 'summary.md', LEAD_SAID);
    }

    return plan.runId;
  };

  /** A scripted agent takes a task: its context carries the token from then on. */
  const take = async (name: string, taskId: string, runId = 'es-launch') => {
    const taken = await takeTask(bench().agent(name), runId, taskId);

    return { ...taken, ctx: bench().agent(name, { token: taken.token }) };
  };

  /** Takes, writes, completes and approves a task: the whole round a subagent and its reviewer make. */
  const doTask = async (name: string, taskId: string, file: string, text: string, runId = 'es-launch') => {
    const held = await take(name, taskId, runId);
    await writeInCopy(held.work, file, text);
    await completeTask(held.ctx, runId, taskId);

    return reviewTask(lead(), runId, taskId, 'approve', []);
  };

  const looked = (taskId: string, runId = 'es-launch') => lookedAt(lead(), runId, taskId);

  return { refusal, lead, openWith, open, take, doTask, looked };
};
