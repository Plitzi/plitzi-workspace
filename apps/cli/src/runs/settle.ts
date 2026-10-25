import { requireLead } from './leads';
import { RunRefusal } from './refusal';
import { loadRun, logRun, requireNoTask } from './run';
import { viewRun } from './view';

import type { RunContext } from './run';

/**
 * `plitzi run settle`: the lead says what it did about a finding the run's records raised — an agent that went on after
 * it was told to stop, a check that answered two ways — and it leaves the lead's attention. Said, never cleared in
 * silence: the note is kept in the log, beside the finding the report keeps. A run's close waited on three findings
 * no task held, with no way for the lead to settle one.
 */

/** A finding the lead settled, as the log keeps it: what it was about, and what the lead did. */
export const SETTLED = 'finding-settled';

/** The subjects of the findings the lead settled, read off the run's log. */
export const settledFindings = (log: readonly Record<string, unknown>[]): Set<string> =>
  new Set(log.flatMap(entry => (entry.action === SETTLED && typeof entry.subject === 'string' ? [entry.subject] : [])));

export const settleFinding = async (
  ctx: RunContext,
  runId: string,
  subject: string,
  note: string
): Promise<{ subject: string; text: string }> => {
  requireNoTask(ctx, 'settle a finding');
  const loaded = await loadRun(ctx, runId);
  await requireLead(ctx, loaded, 'settle a finding');
  if (note.trim() === '') {
    throw new RunRefusal(
      'invalid',
      'Say what you did about it: plitzi run settle <finding> --note "…" — a finding is settled by what was done.'
    );
  }

  const findings = (await viewRun(ctx, runId)).attention.filter(item => item.kind === 'finding');
  const finding = findings.find(item => item.subject === subject);
  if (!finding) {
    throw new RunRefusal(
      'not-found',
      findings.length === 0
        ? `No finding waits for the lead: "${subject}" is none of them.`
        : `No finding waits for the lead as "${subject}". These do: ${findings.map(item => item.subject ?? '').join(', ')}`
    );
  }

  await logRun(ctx, loaded.paths, { action: SETTLED, subject, note: note.trim() });

  return { subject, text: finding.text };
};
