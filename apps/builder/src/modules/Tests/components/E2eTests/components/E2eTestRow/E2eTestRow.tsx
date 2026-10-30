import Badge from '@plitzi/plitzi-ui/Badge';
import Button from '@plitzi/plitzi-ui/Button';
import { useCallback } from 'react';

import type { E2eTest } from '@plitzi/sdk-shared';
import type { TSpaceE2eResult } from '@plitzi/sdk-shared/network';

export type E2eTestRowProps = {
  test: E2eTest;
  /** How it went the last time it was played on the draft; none until it is. */
  result?: TSpaceE2eResult;
  /** Why it was not run, when the server could not play it: said, never taken as passed. */
  notRun?: string;
  onEdit: (id: string) => void;
  onRemove: (id: string) => void;
  /** Opens its last run, replayed step by step. */
  onView: (id: string) => void;
};

/** One e2e test: the page it opens, at what width, how many steps — and that it was not run here, when it was not. */
const E2eTestRow = ({ test, result, notRun, onEdit, onRemove, onView }: E2eTestRowProps) => {
  const failed = result?.steps.find(step => !step.ok && step.notRun !== true);
  const handleEdit = useCallback(() => onEdit(test.id), [onEdit, test.id]);
  const handleRemove = useCallback(() => onRemove(test.id), [onRemove, test.id]);
  const handleView = useCallback(() => onView(test.id), [onView, test.id]);

  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-gray-200 px-3 py-2 dark:border-zinc-700">
      <div className="flex min-w-0 flex-col gap-1">
        <span className="truncate text-sm text-zinc-900 dark:text-zinc-100">{test.title || test.id}</span>
        <span className="font-mono text-xs text-gray-500 dark:text-zinc-400">
          {test.page} · {test.width ?? 1440} px · {test.steps.length} step{test.steps.length === 1 ? '' : 's'}
        </span>
        {result && !result.ok && (
          <span className="text-xs text-red-600 dark:text-red-400">
            {result.problem ?? `${failed?.said ?? ''} — ${failed?.read ?? ''}`}
          </span>
        )}
        {notRun && <span className="text-xs text-amber-600 dark:text-amber-400">Not run: {notRun}</span>}
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
        {result && (
          <Button size="sm" intent="secondary" onClick={handleView}>
            View run
          </Button>
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

export default E2eTestRow;
