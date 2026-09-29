import clsx from 'clsx';

import serverCodeKindOf from './serverCodeKindOf';
import ResourceLoading from '../../ResourceLoading';
import ResourceRemoveButton from '../../ResourceRemoveButton';

import type { MouseEvent } from 'react';

export type ResourceServerCodeProps = {
  className?: string;
  id: string;
  /** The versions of the space that run it: while any does, it cannot be removed. */
  usedBy?: string[];
  removing?: boolean;
  isLoading?: boolean;
  onRemove?: (e: MouseEvent) => void;
};

/**
 * A file of the space's server code on its private CDN — its functions or its runtime, kept by saves and pushes and
 * named by what it holds. No preview and no address: a private CDN serves nothing. What it shows is which versions run
 * it, so what nothing runs any more can be cleared from here.
 */
const ResourceServerCode = ({
  className,
  id,
  usedBy = [],
  removing = false,
  isLoading = false,
  onRemove
}: ResourceServerCodeProps) => {
  const inUse = usedBy.length > 0;
  const digest = id.split('/').pop()?.split('.')[0] ?? '';

  return (
    <div
      className={clsx(
        'group relative flex w-full flex-col gap-1 overflow-hidden rounded-md border border-gray-300 p-2 text-xs select-none dark:border-zinc-600',
        className
      )}
      title={id}
    >
      <div className="flex items-center gap-2">
        <i className="fa-solid fa-server text-gray-400 dark:text-zinc-500" />
        <span className="font-semibold text-gray-700 dark:text-zinc-200">{serverCodeKindOf(id)}</span>
        <span className="truncate font-mono text-gray-400 dark:text-zinc-500">{digest.slice(0, 12)}</span>
      </div>
      {inUse && (
        <span className="text-emerald-700 dark:text-emerald-400">
          <i className="fa-solid fa-lock mr-1" />
          In use: {usedBy.join(', ')}
        </span>
      )}
      {!inUse && <span className="text-gray-500 dark:text-zinc-400">Not used by any version</span>}
      {!inUse && <ResourceRemoveButton onRemove={onRemove} />}
      {(isLoading || removing) && <ResourceLoading />}
    </div>
  );
};

export default ResourceServerCode;
