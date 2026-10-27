import { isApproval } from './run';

import type { LogEntry } from './findings/types';
import type { RunReport } from './report';

/**
 * What a person reads before applying the run, first in its report: whether the finish's dry run passed, and what it
 * holds that the approvals alone do not say. encore-10's person asked the lead for an analysis of the whole run before
 * its `--apply`: the report had every fact, none of them where the decision is made.
 */

/** What the finish's dry run said, and the lines the lead rewrote once their tasks were done. */
export interface ApplyFacts {
  /** The finish's dry run passing (`ready`): the files it writes, the acceptance lines it held on the whole result. */
  ready?: { at: string; files: number; acceptance: number };
  /** Tasks whose acceptance the lead rewrote after they were approved: the finish holds them to the new line. */
  amendedDone: string[];
}

const text = (value: unknown): string => (typeof value === 'string' ? value : '');

export const applyFacts = (log: readonly LogEntry[]): ApplyFacts => {
  const ready = log.findLast(entry => entry.action === 'ready');
  const approvedAt = new Map(log.filter(isApproval).map(entry => [text(entry.task), text(entry.at)] as const));
  const amendedDone = log.flatMap(entry =>
    entry.action === 'amend' && Array.isArray(entry.tasks)
      ? entry.tasks.flatMap(each => {
          const task = typeof each === 'object' && each !== null ? text(Reflect.get(each, 'task')) : '';
          const approved = approvedAt.get(task);

          return approved !== undefined && approved < text(entry.at) ? [task] : [];
        })
      : []
  );

  return {
    ...(ready
      ? {
          ready: {
            at: text(ready.at),
            files: typeof ready.files === 'number' ? ready.files : 0,
            acceptance: typeof ready.acceptance === 'number' ? ready.acceptance : 0
          }
        }
      : {}),
    amendedDone: [...new Set(amendedDone)]
  };
};

/** The section itself: ready or not, and what weighs on applying it — or that it was applied. */
export const applyText = (report: RunReport, applied: boolean): string[] => {
  const { apply } = report;
  const knownFailures = report.tasks.filter(task => task.knownFailure !== undefined);
  const plitzi = report.findings.filter(finding => finding.owner === 'plitzi').length;
  const lead = report.findings.filter(finding => finding.owner === 'lead');

  return [
    applied ? '## Applied' : '## Before you apply',
    '',
    apply?.ready
      ? `- **The finish's dry run passed** at ${apply.ready.at.slice(11, 16)} UTC: ${String(apply.ready.files)} files to write, ${String(apply.ready.acceptance)} acceptance lines held on the whole result — the project's checks too.`
      : '- **The finish has not passed its dry run**: `plitzi run finish` says what holds it — nothing is to be applied before.',
    ...knownFailures.map(task => `- ${task.id} was approved over a known failure: ${task.knownFailure ?? ''}`),
    ...(apply && apply.amendedDone.length > 0
      ? [
          `- Acceptance rewritten after approval — the finish held them to the new lines: ${apply.amendedDone.join(', ')}`
        ]
      : []),
    ...(report.noticed.length > 0
      ? [
          `- ${String(report.noticed.length)} notice(s) of the project go to its backlog (\`.plitzi/backlog.json\`): below`
        ]
      : []),
    ...(lead.length > 0 ? [`- The lead's own problems: ${lead.map(finding => finding.title).join(' · ')}`] : []),
    ...(plitzi > 0
      ? [`- ${String(plitzi)} problem(s) of Plitzi's, for its team: \`feedback.md\` beside this report`]
      : []),
    ...(applied ? [] : [`- Apply: \`plitzi run finish ${report.runId} --apply\` — a person's`]),
    ''
  ];
};
