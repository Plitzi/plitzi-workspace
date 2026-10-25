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
          (entry.action === 'review' ||
            entry.action === 'design-review' ||
            entry.action === 'review-taken' ||
            entry.action === 'look')
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
        fix: 'a designer free for UI reviews, and run watch --until lead answering the review first',
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

    // Sent back, by whom: its UI's review and the lead's are rounds of their own (a designer's changes were logged as
    // a review by the designer's name before they were design reviews).
    const changes = log.filter(
      entry =>
        entry.task === task.id &&
        entry.verdict === 'changes' &&
        (entry.action === 'review' || entry.action === 'design-review')
    );
    const byUi = changes.filter(entry => entry.action === 'design-review' || !text(entry.by).startsWith('lead')).length;
    if (changes.length >= 3) {
      findings.push({
        kind: 'sent-back',
        owner: 'lead',
        title: `${task.id} was sent back ${String(changes.length)} times`,
        evidence: [`${String(byUi)} by its UI review, ${String(changes.length - byUi)} by the lead`],
        times: changes.length,
        fix: 'what the reviews asked, in its brief or its lines from the start',
        subject: `sent-back:${task.id}`
      });
    }
  }

  // Said by why, each apart: a UI the lead looked at is not one nobody did, nor a task with no UI at all.
  const skipped = by('review').filter(entry => entry.design === 'skipped');
  const skippedAs = (why: string | undefined) =>
    skipped.filter(entry => (typeof entry.designSkip === 'string' ? entry.designSkip : undefined) === why);
  for (const [why, said] of [
    ['lead', 'Their UI reviewed by the lead, not a designer'],
    ['no-ui', 'No UI to review, approved on their code (task complete --review code says it from the start)'],
    [undefined, 'Approved without their designer’s UI review, the reason unsaid']
  ] as const) {
    const these = skippedAs(why);
    if (these.length > 0) {
      findings.push({
        kind: 'ui-skipped',
        owner: 'lead',
        title: said,
        evidence: [these.map(entry => text(entry.task)).join(', ')],
        times: these.length,
        subject: `ui-skipped:${why ?? 'unsaid'}`
      });
    }
  }

  // A designer at a UI review the lead then went past: its review was wasted, and its finding went nowhere.
  const wasted = skipped.filter(each => typeof each.designBy === 'string');
  if (wasted.length > 0) {
    findings.push({
      kind: 'ui-review-wasted',
      owner: 'lead',
      title: 'UI reviews taken by a designer and gone past by the lead',
      evidence: wasted.map(entry => `${text(entry.designBy)} had taken ${text(entry.task)}'s`),
      times: wasted.length,
      subject: 'ui-review-wasted'
    });
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
  for (const refused of by('refused')) {
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
