import clsx from 'clsx';
import { useCallback } from 'react';

import { useBuilderStore } from '@plitzi/sdk-shared/store';
import { chainOf } from '@pmodules/Builder/helpers/elementChain';
import useRevealElement from '@pmodules/Builder/hooks/useRevealElement';

import { TREE_ICON } from '../../../../helpers/copy';

import type { ElementUsage } from '../../../../helpers/usageIndex';

export type UsageOwnerProps = {
  owner: ElementUsage;
  /** A component's root, which the link opens; otherwise the element that provides the item. */
  opensComponent: boolean;
};

/** Where the item is declared — a component's own tree, a data source's provider — and the way to it. */
const UsageOwner = ({ owner, opensComponent }: UsageOwnerProps) => {
  const [flat] = useBuilderStore('schema.flat');
  const revealElement = useRevealElement();

  const handleReveal = useCallback(
    () => revealElement({ id: owner.elementId, ...chainOf(flat, owner.elementId) }),
    [flat, owner.elementId, revealElement]
  );

  return (
    <button
      type="button"
      className="flex min-w-0 cursor-pointer items-center gap-1.5 self-start rounded bg-zinc-100 px-1.5 py-0.5 text-[11px] text-indigo-700 hover:bg-indigo-50 dark:bg-zinc-800 dark:text-indigo-300 dark:hover:bg-zinc-700"
      title={opensComponent ? 'Open this component in the canvas' : `Select ${owner.elementId}`}
      onClick={handleReveal}
    >
      <i className={clsx(TREE_ICON[owner.tree.kind], 'text-[10px]')} />
      {opensComponent && <span className="truncate">Open the component</span>}
      {!opensComponent && (
        <span className="truncate">
          Provided by <span className="font-mono">{owner.elementId}</span> on {owner.tree.label}
        </span>
      )}
    </button>
  );
};

export default UsageOwner;
