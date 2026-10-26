import { isRecord } from '@plitzi/sdk-shared/helpers';

import { saysAlike } from './words';

import type { Finding } from './types';
import type { KeptReport } from '../reports';

/**
 * Each finding held against the runs before it: new, or met again — and in which. After encore-10 (49 problems of
 * Plitzi's, as many as the runs before) nobody could say whether fixing worked: a repeat is what a fix did not stop,
 * a new one what the run explored. Read off the reports the project keeps (`.plitzi/plitzi-reports/runs/`).
 */

/** A finding of a run before, as its `report.json` kept it. */
interface PastFinding {
  kind: string;
  subject: string;
  title: string;
}

/** The findings each run before kept, oldest first — never the run itself, nor one after it. */
export const pastFindingsOf = (
  reports: readonly KeptReport[],
  runId: string,
  before: string
): { runId: string; findings: PastFinding[] }[] =>
  reports
    .filter(report => report.runId !== runId && report.at < before)
    .map(report => {
      const kept = isRecord(report.data.report) ? report.data.report.findings : undefined;

      return {
        runId: report.runId,
        findings: (Array.isArray(kept) ? kept : []).flatMap(finding =>
          isRecord(finding) &&
          typeof finding.kind === 'string' &&
          typeof finding.subject === 'string' &&
          typeof finding.title === 'string'
            ? [{ kind: finding.kind, subject: finding.subject, title: finding.title }]
            : []
        )
      };
    });

/**
 * One thing found again: of its kind and subject — a command too long again (`large-output:task show`) — or, said by
 * whoever worked (a subject of its moment), said alike. A title alone matched too much: "t-a took 40 min of 20" is
 * every run's, about another task.
 */
const foundAgain = (finding: Finding, past: PastFinding): boolean =>
  past.kind === finding.kind &&
  (finding.kind === 'said' ? saysAlike(past.title, finding.title) : past.subject === finding.subject);

export const withHistory = (
  findings: readonly Finding[],
  past: readonly { runId: string; findings: readonly PastFinding[] }[]
): Finding[] =>
  findings.map(finding => {
    const seenIn = past.filter(run => run.findings.some(each => foundAgain(finding, each))).map(run => run.runId);

    return seenIn.length > 0 ? { ...finding, seenIn } : finding;
  });
