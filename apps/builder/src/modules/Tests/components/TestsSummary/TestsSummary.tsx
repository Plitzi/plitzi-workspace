import clsx from 'clsx';

import { problemInWords, problemsOfKind } from '../../helpers';

import type { TSpaceTests } from '@plitzi/sdk-shared/network';

export type TestsSummaryProps = {
  answer: TSpaceTests;
  /** What is wrong with the tests as written, read against the document being edited. */
  problems: readonly string[];
};

/**
 * How the space's tests stand against the saved document — what a snapshot would meet. What passes is said as passing;
 * a test written so it cannot be read, or a check that does not hold yet, is said calmly beside it: by the title its
 * author gave it, what is wrong, and what it holds back — a snapshot — and what it does not: the site as published.
 */
const TestsSummary = ({ answer, problems: all }: TestsSummaryProps) => {
  const total = answer.unitPassed + answer.unitFailed;
  // The element checks' own: what a flow needs is said where the flows are.
  const problems = problemsOfKind(all, 'unit');
  const needs = problems.length + answer.unitFailed;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1 text-sm">
        <span
          className={clsx({
            'text-emerald-600 dark:text-emerald-400': answer.unitFailed === 0,
            'text-amber-700 dark:text-amber-300': answer.unitFailed > 0
          })}
        >
          <b className="text-2xl font-semibold">{answer.unitPassed}</b>/{total} element checks pass
        </span>
        <span className="text-gray-500 dark:text-zinc-400">
          <b className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">{answer.tests.e2e?.length ?? 0}</b>{' '}
          flows — played with “Play all here”, or “Run on the server”
        </span>
      </div>
      {needs > 0 && (
        <div
          role="status"
          className="flex gap-2.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5 text-sm text-amber-900 dark:border-amber-700/60 dark:bg-amber-950/30 dark:text-amber-100"
        >
          <i className="fa-solid fa-circle-info mt-0.5 text-amber-500" />
          <div className="flex flex-col gap-1">
            <span className="font-medium">
              {needs === 1 ? '1 element check needs a look' : `${String(needs)} element checks need a look`} — a
              snapshot waits until it is fixed. Your site as published does not change meanwhile.
            </span>
            <ul className="flex flex-col gap-0.5 text-xs text-amber-800 dark:text-amber-200">
              {problems.map(problem => {
                const { test, said } = problemInWords(problem, answer.tests);

                return (
                  <li key={problem}>
                    {test && <b className="font-semibold">“{test}”: </b>}
                    {said}
                  </li>
                );
              })}
              {answer.unitFailed > 0 && (
                <li>
                  {answer.unitFailed === 1
                    ? '1 element check does not hold yet'
                    : `${String(answer.unitFailed)} element checks do not hold yet`}{' '}
                  — each says below what it read.
                </li>
              )}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

export default TestsSummary;
