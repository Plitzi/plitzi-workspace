import { describe, expect, it } from 'vitest';

import { isRunReport, RUN_REPORT_STEPS_MOST, runReportProblems } from './report';

const report = {
  text: 'Strongest breaks',
  path: '/?sample=active',
  width: 390,
  height: 844,
  scheme: 'dark',
  steps: [
    { kind: 'click', element: 'layer-quakes' },
    { kind: 'type', element: 'pin', secret: true }
  ],
  at: '2026-10-31T10:00:00.000Z'
};

describe('a report from a run’s preview', () => {
  it('is one with its words, its address, its window, its theme and its steps', () => {
    expect(isRunReport(report)).toBe(true);
  });

  it('says every problem at once', () => {
    expect(
      runReportProblems({
        ...report,
        path: 'sample',
        scheme: 'sepia',
        element: '',
        steps: [{ kind: 'drag', element: 'x' }],
        at: 'yesterday'
      })
    ).toEqual([
      'path: the page’s path, from "/"',
      'scheme: light or dark',
      'element: the id of the element pointed at',
      `steps: at most ${String(RUN_REPORT_STEPS_MOST)}, each a click or a type of an element`,
      'at: when, ISO'
    ]);
    expect(runReportProblems('text')).toEqual(['a report is a JSON object']);
  });
});
