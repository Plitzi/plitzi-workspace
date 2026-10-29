import { requireLead } from '../agents/leads';
import { RunRefusal } from '../core/refusal';
import { runLiveFindings } from '../findings/live';
import { loadRun, logRun, readRunLog, requireNoTask } from '../run';
import { SETTLED, settledFindings } from './settled';
import { ADVICE_KINDS } from '../view/bottlenecks';
import { viewRun } from '../view/view';

import type { RunContext } from '../run';

/**
 * `plitzi run settle`: the lead says what it did about a finding the run's records raised — an agent that went on after
 * it was told to stop, a check that answered two ways — and it leaves the lead's attention. Said, never cleared in
 * silence: the note is kept in the log, beside the finding the report keeps. A run's close waited on three findings
 * no task held, with no way for the lead to settle one.
 */

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
  // Advice comes and goes with the agents running — one started again between two cards is not idle for a moment —
  // so a kind is settled whether given this instant or not: a run's lead settled idle-team in such a moment, was
  // refused, and was woken for it again at once.
  if (!finding && isAdvice(subject)) {
    if (settledFindings(await readRunLog(loaded.paths)).has(subject)) {
      throw new RunRefusal('invalid', `"${subject}" is settled already: it is said no more in this run.`);
    }

    await logRun(ctx, loaded.paths, { action: SETTLED, subject, note: note.trim() });

    return { subject, text: `${subject}: not given at this moment — said no more in this run` };
  }

  // Read in the attention a moment before, and past since — its task's next check passed: still the run's, settled by
  // its name. A run's lead settled two lines it had just read, and was told they were no finding.
  if (!finding) {
    const log = await readRunLog(loaded.paths);
    const raised = (await runLiveFindings(loaded, log)).find(each => each.subject === subject);
    if (raised) {
      if (settledFindings(log).has(subject)) {
        throw new RunRefusal('invalid', `"${subject}" is settled already: it is said no more in this run.`);
      }

      await logRun(ctx, loaded.paths, { action: SETTLED, subject, note: note.trim() });

      return { subject, text: `${raised.title} — past already, settled as you said` };
    }
  }

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
