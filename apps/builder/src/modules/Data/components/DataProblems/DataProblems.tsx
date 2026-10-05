import { useCallback } from 'react';

import type { DataProblem } from '@plitzi/sdk-shared';

export type DataProblemsProps = {
  problems: DataProblem[];
  /** The file a problem is about, to open. */
  onSelect: (file: string) => void;
};

/** What the last save found wrong, by file: nothing was kept. */
const DataProblems = ({ problems, onSelect }: DataProblemsProps) => {
  const handleSelect = useCallback((file: string) => () => onSelect(file), [onSelect]);

  return (
    <div className="flex max-h-40 flex-col gap-1 overflow-auto border-t border-red-300 bg-red-50 p-2 dark:border-red-900 dark:bg-red-950/40">
      <span className="text-xs font-medium text-red-700 dark:text-red-300">Not saved — fix these first</span>
      {problems.map(problem => (
        <button
          key={`${problem.file} ${problem.message}`}
          type="button"
          className="text-left font-mono text-xs text-red-800 hover:underline dark:text-red-200"
          onClick={handleSelect(problem.file)}
        >
          <span className="font-semibold">{problem.file}</span> {problem.message}
        </button>
      ))}
    </div>
  );
};

export default DataProblems;
