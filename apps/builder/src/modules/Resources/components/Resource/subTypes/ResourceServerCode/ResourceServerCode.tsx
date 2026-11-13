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
 * A file of the space's server code in its private bucket — its functions or its runtime, kept by saves and pushes
 * and named by what it holds. No preview and no address: a private bucket serves nothing. What it shows is which
 * versions run it, so what nothing runs any more can be cleared from here.
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
        'group border-ui-line-strong relative flex w-full flex-col gap-1 overflow-hidden rounded-md border p-2 text-xs select-none',
        className
      )}
      title={id}
    >
      <div className="flex items-center gap-2">
        <i className="fa-solid fa-server text-ui-fg-subtle" />
        <span className="text-ui-fg font-semibold">{serverCodeKindOf(id)}</span>
        <span className="text-ui-fg-subtle truncate font-mono">{digest.slice(0, 12)}</span>
      </div>
      {inUse && (
        <span className="text-emerald-700 dark:text-emerald-400">
          <i className="fa-solid fa-lock mr-1" />
          In use: {usedBy.join(', ')}
        </span>
      )}
      {!inUse && <span className="text-ui-fg-subtle">Not used by any version</span>}
      {!inUse && <ResourceRemoveButton onRemove={onRemove} />}
      {(isLoading || removing) && <ResourceLoading />}
    </div>
  );
};

export default ResourceServerCode;
