import { clock, evidenceOf, text } from './findings/types';
import { readRunLog } from './run';
import { viewTask } from './taskStore';

import type { Finding } from './findings/types';
import type { LoadedRun } from './run';

/**
 * What a run's own activity shows went wrong in how it was worked, read before it closes: never refusing the finish —
 * the work may be right — but said at it and kept in the report, so a CLI's defect or a team's habit is seen once, not
 * found again in the next run. Each finding names what it is about, with the numbers it is read from, and whose it is.
 */

/** A review that waited longer than this after its task was sent: the team, or the lead, was not there for it. */
const SLOW_REVIEW_MS = 10 * 60_000;
/** Refused this many times over, one agent, one code, one command: an agent looping on what it cannot do. */
const LOOP = 3;

const minutes = (ms: number): string => `${String(Math.round(ms / 60_000))} min`;

export const auditRun = async (loaded: LoadedRun): Promise<Finding[]> => {
  const log = await readRunLog(loaded.paths);
  const findings: Finding[] = [];
  const by = (action: string, task?: string) =>
    log.filter(entry => entry.action === action && (task === undefined || entry.task === task));

  for (const task of loaded.tasks) {
    const { state } = await viewTask(loaded.paths, task);
    // A spike ends with what it found (`spike-done`), never with an approval: a run's s-scope read as missed.
    const approvals = [
      ...by('review', task.id).filter(entry => entry.verdict === 'approve'),
      ...by('spike-done', task.id)
    ];
    if (state.status === 'done' && approvals.length === 0) {
      findings.push({
        kind: 'approval-missing',
        owner: 'plitzi',
        area: 'cli',
        title: `${task.id} is done, and no approval of it is in the activity`,
        evidence: [`its state: done, round ${String(state.round)}`],
        times: 1,
        fix: 'every step that approves a task logs it',
        subject: `approval-missing:${task.id}`
      });
    }

    // Each time it was sent, how long until a review took it: its UI's, or the lead's.
    const slow: string[] = [];
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
        slow.push(`sent ${clock(sent.at)}, waited ${minutes(waited)}`);
      }
    }

    if (slow.length > 0) {
      findings.push({
        kind: 'slow-review',
        owner: 'lead',
        title: `${task.id} waited in review before anyone looked at it`,
        evidence: slow,
        times: slow.length,
        fix: 'a reviewer free for each step its card names, and run watch answering the review first',
        subject: `slow-review:${task.id}`
      });
    }

    if (state.knownFailure) {
      const known = state.knownFailure;
      findings.push({
        kind: 'known-failure',
        owner: 'lead',
        title: `${task.id} went to review with a known failure: ${known.failing.join(', ')}`,
        evidence: [
          `${known.why}${known.fixedBy ? ` — fixed by ${known.fixedBy}` : known.preexisting ? ' — there before it' : ''}`
        ],
        times: 1,
        subject: `known-failure:${task.id}`
      });
    }

    // Sent back, by whom: each step of its review says its own.
    const changes = log.filter(
      entry => entry.task === task.id && entry.verdict === 'changes' && entry.action === 'review'
    );
    if (changes.length >= 3) {
      const stepOf = (entry: Record<string, unknown>): string => (typeof entry.step === 'string' ? entry.step : 'lead');
      const bySteps = new Map<string, number>();
      for (const entry of changes) {
        bySteps.set(stepOf(entry), (bySteps.get(stepOf(entry)) ?? 0) + 1);
      }

      findings.push({
        kind: 'sent-back',
        owner: 'lead',
        title: `${task.id} was sent back ${String(changes.length)} times`,
        evidence: [[...bySteps].map(([step, times]) => `${String(times)} by its ${step}'s review`).join(', ')],
        times: changes.length,
        fix: 'what the reviews asked, in its brief or its lines from the start',
        subject: `sent-back:${task.id}`
      });
    }
  }

  const crashed = by('crashed');
  if (crashed.length > 0) {
    findings.push({
      kind: 'crashed',
      owner: 'plitzi',
      area: 'cli',
      title: `${String(crashed.length)} command(s) crashed`,
      evidence: evidenceOf(
        crashed.map(
          crash =>
            `${clock(crash.at)} ${text(crash.by)}: ${text(crash.command)} — ${text(crash.error).split('\n')[0]?.slice(0, 200) ?? ''}`
        )
      ),
      times: crashed.length,
      fix: 'a crash is a refusal nobody wrote: what it met, said in a sentence with its way out',
      subject: 'crashed'
    });
  }

  for (const failed of by('preview-sync-failed')) {
    findings.push({
      kind: 'preview-sync',
      owner: 'plitzi',
      area: 'cli',
      title: `The preview did not take ${text(failed.task)} in`,
      evidence: [text(failed.error)],
      times: 1,
      subject: `preview-sync:${text(failed.task)}`
    });
  }

  for (const brake of by('brake')) {
    findings.push({
      kind: 'brake',
      owner: 'lead',
      title: `The brake stopped the run at ${clock(brake.at)}`,
      evidence: [text(brake.reason)],
      times: 1,
      subject: `brake:${text(brake.at)}`
    });
  }

  // The same refusal, met again and again by one agent: a loop, the CLI's or the agent's.
  const refusals = new Map<string, number>();
  for (const refused of by('refused').filter(entry => entry.handed !== true)) {
    const command = text(refused.command).split(' ').slice(0, 3).join(' ');
    const key = `${text(refused.by)} · ${text(refused.code)} · ${command}`;
    refusals.set(key, (refusals.get(key) ?? 0) + 1);
  }

  for (const [key, count] of refusals) {
    if (count >= LOOP) {
      findings.push({
        kind: 'refused-loop',
        owner: 'plitzi',
        area: 'cli',
        title: `Refused ${String(count)} times over: ${key}`,
        evidence: [key],
        times: count,
        fix: 'the refusal names what to do instead, or the command does it',
        subject: `refused-loop:${key}`
      });
    }
  }

  return findings;
};
