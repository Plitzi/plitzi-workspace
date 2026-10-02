import clsx from 'clsx';

import ResourceName from '../../ResourceName';
import ResourceRemoveButton from '../../ResourceRemoveButton';

import type { MouseEvent } from 'react';

export type UnreadableSnippetProps = {
  className?: string;
  title?: string;
  onRemove?: (e: MouseEvent) => void;
};

/**
 * A file among the snippets that is not one — unreachable, or a JSON of some other shape. Shown rather than left out,
 * so whoever put it there sees it and can take it away.
 */
const UnreadableSnippet = ({ className, title, onRemove }: UnreadableSnippetProps) => (
  <div
    className={clsx(
      'group relative flex w-full flex-col gap-1 overflow-hidden rounded-md border border-dashed border-gray-300 p-3 select-none [column-span:all] dark:border-zinc-600',
      className
    )}
  >
    <span className="text-xs text-gray-500 dark:text-zinc-400">Not a snippet this builder can read</span>
    <ResourceRemoveButton onRemove={onRemove} />
    <ResourceName name={title} />
  </div>
);

export default UnreadableSnippet;
