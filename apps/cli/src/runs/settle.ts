import { ADVICE_KINDS } from './bottlenecks';
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

const isAdvice = (kind: string): boolean => ADVICE_KINDS.some(each => each === kind);

export const settleFinding = async (
  ctx: RunContext,
  runId: string,
  subject: string,
  note: string
): Promise<{ subject: string; text: string }> => {
  requireNoTask(ctx, 'settle a finding');
  const loaded = await loadRun(ctx, runId);
  await requireLead(ctx, 'settle a finding');
  if (note.trim() === '') {
    throw new RunRefusal(
      'invalid',
      'Say what you did about it: plitzi run settle <finding> --note "…" — a finding is settled by what was done.'
    );
  }

  // A finding by its subject, or the board's advice by its kind: what the lead decided about it, said once.
  const { attention } = await viewRun(ctx, runId);
  const findings = attention.filter(item => item.kind === 'finding');
  const advice = attention.filter(item => isAdvice(item.kind));
  const finding =
    findings.find(item => item.subject === subject) ??
    advice.find(item => item.kind === subject && item.who === 'lead');
  if (!finding) {
    const settleable = [...findings.map(item => item.subject ?? ''), ...new Set(advice.map(item => item.kind))];
    throw new RunRefusal(
      'not-found',
      settleable.length === 0
        ? `Nothing waits for the lead to settle: "${subject}" is no finding, and no advice of that kind is given now.`
        : `Nothing to settle as "${subject}". These are: ${settleable.join(', ')} — a finding by its name, the board's advice by its kind`,
      { next: 'plitzi run status says what waits for the lead, each by its name' }
    );
  }

  await logRun(ctx, loaded.paths, { action: SETTLED, subject, note: note.trim() });

  return { subject, text: finding.text };
};
