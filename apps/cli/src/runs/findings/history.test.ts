import { describe, expect, it } from 'vitest';

import { pastFindingsOf, withHistory } from './history';
import { historyText } from '../reportHead';

import type { Finding } from './types';
import type { KeptReport } from '../reports';

const finding = (over: Partial<Finding>): Finding => ({
  kind: 'large-output',
  owner: 'plitzi',
  title: 'task show answered with 35k characters',
  evidence: [],
  times: 1,
  subject: 'large-output:task show',
  ...over
});

const kept = (runId: string, at: string, findings: Partial<Finding>[]): KeptReport => ({
  runId,
  at,
  data: { report: { at, findings: findings.map(finding) } }
});

// After encore-10 nobody could say whether fixing worked: 49 problems, as many as the runs before, new or not.
describe('a finding held against the runs before', () => {
  const reports = [
    kept('encore-5', '2026-10-20T10:00:00Z', [
      {},
      { kind: 'over-estimate', subject: 'over-estimate:t-home', title: 't-home took 40 min of an estimated 20' }
    ]),
    kept('encore-6', '2026-10-22T10:00:00Z', [
      {
        kind: 'said',
        subject: 'notice:x',
        title: "page play 'action <id>' answered 401 and did not point to --as <account>"
      }
    ]),
    kept('encore-10', '2026-10-26T10:00:00Z', [{}])
  ];

  it('is met again by its subject — or, said by whoever worked, said alike — never by a title shaped the same', () => {
    const past = pastFindingsOf(reports, 'encore-10', '2026-10-26T10:00:00Z');
    expect(past.map(run => run.runId)).toEqual(['encore-5', 'encore-6']);

    const [long, overrun, said, fresh] = withHistory(
      [
        finding({}),
        finding({
          kind: 'over-estimate',
          subject: 'over-estimate:t-visual-specs',
          title: 't-visual-specs took 148 min of an estimated 60'
        }),
        finding({
          kind: 'said',
          subject: 'notice:y',
          title: 'page play action answered 401 with no hint of --as <account>'
        }),
        finding({ subject: 'large-output:task look', title: 'task look answered with 14k characters' })
      ],
      past
    );

    expect(long.seenIn).toEqual(['encore-5']);
    expect(overrun.seenIn).toBeUndefined();
    expect(said.seenIn).toEqual(['encore-6']);
    expect(fresh.seenIn).toBeUndefined();
    expect(historyText(long)).toBe('met before — encore-5 (2nd run)');
    expect(historyText(fresh)).toBe('new');
  });
});
