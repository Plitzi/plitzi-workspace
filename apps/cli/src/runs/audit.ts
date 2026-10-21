import { readRunLog } from './run';
import { viewTask } from './taskStore';

import type { LoadedRun } from './run';

/**
 * What a run's own activity shows went wrong in how it was worked, read before it closes: never refusing the finish —
 * the work may be right — but said at it and kept in the report, so a CLI's defect or a team's habit is seen once, not
 * found again in the next run. Each finding names what it is about, with the numbers it is read from.
 */

/** A review that waited longer than this after its task was sent: the team, or the lead, was not there for it. */
const SLOW_REVIEW_MS = 10 * 60_000;
/** Refused this many times over, one agent, one code, one command: an agent looping on what it cannot do. */
const LOOP = 3;
/** Failed checks of one task past this: the task, or the check, is wrong. */
const MANY_CHECKS = 6;

const text = (value: unknown): string => (typeof value === 'string' ? value : '');
const minutes = (ms: number): string => `${String(Math.round(ms / 60_000))} min`;

export const auditRun = async (loaded: LoadedRun): Promise<string[]> => {
  const log = await readRunLog(loaded.paths);
  const findings: string[] = [];
  const by = (action: string, task?: string) =>
    log.filter(entry => entry.action === action && (task === undefined || entry.task === task));

  for (const task of loaded.tasks) {
    const { state } = await viewTask(loaded.paths, task);
    const approvals = by('review', task.id).filter(entry => entry.verdict === 'approve');
    if (state.status === 'done' && approvals.length === 0) {
      findings.push(`${task.id} is done, and no approval of it is in the activity: it was approved by a step the log missed`);
    }

    const failedChecks = by('check', task.id).filter(entry => entry.ok === false).length;
    if (failedChecks > MANY_CHECKS) {
      findings.push(`${task.id}'s checks failed ${String(failedChecks)} times: the task's work, or a check it could not pass`);
    }

    // Each time it was sent, how long until a review took it: its UI's, or the lead's.
    for (const sent of by('complete', task.id)) {
      const after = log.find(
        entry =>
          text(entry.at) > text(sent.at) &&
          entry.task === task.id &&
          (entry.action === 'review' || entry.action === 'review-taken' || entry.action === 'look')
      );
      // Done with nothing after it in the log is the approval the log missed — said above, not timed.
      if (!after && state.status === 'done') {
        continue;
      }

      const waited = (after ? Date.parse(text(after.at)) : Date.now()) - Date.parse(text(sent.at));
      if (waited > SLOW_REVIEW_MS) {
        findings.push(`${task.id} waited ${minutes(waited)} in review before anyone looked at it (sent ${text(sent.at).slice(11, 16)} UTC)`);
      }
    }

    if (state.knownFailure) {
      const known = state.knownFailure;
      findings.push(
        `${task.id} went to review with a known failure: ${known.why}${known.fixedBy ? ` — fixed by ${known.fixedBy}` : known.preexisting ? ' — there before it' : ''}`
      );
    }

    if (state.round >= 3) {
      findings.push(`${task.id} took ${String(state.round + 1)} rounds of review`);
    }
  }

  const skipped = by('review').filter(entry => entry.design === 'skipped').map(entry => text(entry.task));
  if (skipped.length > 0) {
    findings.push(`Approved without their UI review: ${skipped.join(', ')}`);
  }

  for (const crash of by('crashed')) {
    findings.push(`${text(crash.by)}'s command crashed at ${text(crash.at).slice(11, 16)} UTC: ${text(crash.command)} — ${text(crash.error)}`);
  }

  for (const failed of by('preview-sync-failed')) {
    findings.push(`The preview did not take ${text(failed.task)} in: ${text(failed.error)}`);
  }

  for (const brake of by('brake')) {
    findings.push(`The brake stopped the run at ${text(brake.at).slice(11, 16)} UTC: ${text(brake.reason)}`);
  }

  // The same refusal, met again and again by one agent: a loop, the CLI's or the agent's.
  const refusals = new Map<string, number>();
  for (const refused of by('refused')) {
    const command = text(refused.command).split(' ').slice(0, 3).join(' ');
    const key = `${text(refused.by)} · ${text(refused.code)} · ${command}`;
    refusals.set(key, (refusals.get(key) ?? 0) + 1);
  }

  for (const [key, count] of refusals) {
    if (count >= LOOP) {
      findings.push(`Refused ${String(count)} times over: ${key}`);
    }
  }

  return findings;
};
