import { useCallback } from 'react';

import { problemPlace } from '../../helpers';

import type { FunctionsProblem } from '@plitzi/sdk-shared';

export type FunctionsProblemsProps = {
  problems: FunctionsProblem[];
  /** Where a problem is, to open: its file, and its line when it has one. */
  onSelect: (file: string, line?: number) => void;
};

/** What the last save found wrong, where it is: the build's and the platform's checks, before anything ran. */
const FunctionsProblems = ({ problems, onSelect }: FunctionsProblemsProps) => {
  const handleSelect = useCallback(
    (problem: FunctionsProblem) => () => {
      if (problem.file) {
        onSelect(problem.file, problem.line);
      }
    },
    [onSelect]
  );

  return (
    <div className="flex max-h-40 flex-col gap-1 overflow-auto border-t border-red-300 bg-red-50 p-2 dark:border-red-900 dark:bg-red-950/40">
      <span className="text-xs font-medium text-red-700 dark:text-red-300">Not saved — fix these first</span>
      {problems.map(problem => (
        <button
          key={`${problemPlace(problem)} ${problem.message}`}
          type="button"
          className="text-left font-mono text-xs text-red-800 hover:underline dark:text-red-200"
          onClick={handleSelect(problem)}
        >
          <span className="font-semibold">{problemPlace(problem)}</span> {problem.message}
        </button>
      ))}
    </div>
  );
};

export default FunctionsProblems;
