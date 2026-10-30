import Badge from '@plitzi/plitzi-ui/Badge';
import Button from '@plitzi/plitzi-ui/Button';
import { useCallback } from 'react';

import type { UnitTest } from '@plitzi/sdk-shared';
import type { TSpaceUnitTestResult } from '@plitzi/sdk-shared/network';

export type UnitTestRowProps = {
  test: UnitTest;
  /** How it went against the saved document; none until the space is saved with it. */
  result?: TSpaceUnitTestResult;
  onEdit: (id: string) => void;
  onRemove: (id: string) => void;
};

/** One unit test: what it holds of which element, and how it went — what it missed, said, when it failed. */
const UnitTestRow = ({ test, result, onEdit, onRemove }: UnitTestRowProps) => {
  const handleEdit = useCallback(() => onEdit(test.id), [onEdit, test.id]);
  const handleRemove = useCallback(() => onRemove(test.id), [onRemove, test.id]);

  return (
    <div className="flex items-start justify-between gap-3 rounded-md border border-gray-200 px-3 py-2 dark:border-zinc-700">
      <div className="flex min-w-0 flex-col gap-1">
        <span className="truncate text-sm text-zinc-900 dark:text-zinc-100">{test.title || test.id}</span>
        <span className="font-mono text-xs text-gray-500 dark:text-zinc-400">
          {test.element} · {test.expect.length} expectation{test.expect.length === 1 ? '' : 's'}
        </span>
        {result && !result.ok && (
          <ul className="text-xs text-red-600 dark:text-red-400">
            {result.problem && <li>{result.problem}</li>}
            {result.misses.map(miss => (
              <li key={miss}>{miss}</li>
            ))}
          </ul>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {result?.ok && (
          <Badge intent="success" size="xs" solid={false}>
            Passes
          </Badge>
        )}
        {result && !result.ok && (
          <Badge intent="error" size="xs" solid={false}>
            Fails
          </Badge>
        )}
        <Button size="sm" intent="secondary" onClick={handleEdit}>
          Edit
        </Button>
        <Button size="sm" intent="danger" title="Remove" onClick={handleRemove}>
          <i className="fa-solid fa-trash" />
        </Button>
      </div>
    </div>
  );
};

export default UnitTestRow;
