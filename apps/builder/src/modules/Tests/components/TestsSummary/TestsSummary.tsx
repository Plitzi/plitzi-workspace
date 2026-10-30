import Alert from '@plitzi/plitzi-ui/Alert';

import type { TSpaceTests } from '@plitzi/sdk-shared/network';

export type TestsSummaryProps = { answer: TSpaceTests };

/**
 * How the space's tests stand against the saved document, in a line — what a snapshot would meet: tests written
 * wrong, unit tests failing (either refuses it), and the e2e tests this server has no browser to run.
 */
const TestsSummary = ({ answer }: TestsSummaryProps) => {
  const total = answer.unitPassed + answer.unitFailed;
  const holds = answer.problems.length === 0 && answer.unitFailed === 0;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1 text-sm">
        <span className={holds ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}>
          <b className="text-2xl font-semibold">{answer.unitPassed}</b>/{total} element checks pass
        </span>
        <span className="text-gray-500 dark:text-zinc-400">
          <b className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">{answer.tests.e2e?.length ?? 0}</b>{' '}
          flows
          {answer.e2eNotRun.length > 0 && ' — played with “Play all here”, or “Run on the server”'}
        </span>
      </div>
      {!holds && (
        <Alert intent="error" size="xs" solid={false}>
          A snapshot and a publish wait for these: fix the space or the test.
        </Alert>
      )}
      {answer.problems.length > 0 && (
        <ul className="list-disc pl-5 text-xs text-red-600 dark:text-red-400">
          {answer.problems.map(problem => (
            <li key={problem}>{problem}</li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default TestsSummary;
