import clsx from 'clsx';
import { useCallback, useState } from 'react';

import { useBuilderStore } from '@plitzi/sdk-shared/store';
import { chainOf } from '@pmodules/Builder/helpers/elementChain';
import useRevealElement from '@pmodules/Builder/hooks/useRevealElement';

import { TREE_ICON } from '../../../../helpers/copy';
import UsageElement from '../UsageElement';

import type { TreeGroup } from '../../../../helpers/grouping';
import type { ElementUsage } from '../../../../helpers/usageIndex';

/** Elements shown before the rest are asked for: a class worn on every card of a catalogue is a long list. */
const SHOWN = 25;

export type UsageTreeGroupProps = {
  group: TreeGroup;
  /** Unfolded from the start; folded, its name and count alone — a long list of places reads as its pages first. */
  defaultOpen?: boolean;
};

/** The uses in one page, layout or component, under its name — which folds them away and back. */
const UsageTreeGroup = ({ group, defaultOpen = true }: UsageTreeGroupProps) => {
  const { tree, elements } = group;
  const [open, setOpen] = useState(defaultOpen);
  const [flat] = useBuilderStore('schema.flat');
  const revealElement = useRevealElement();
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? elements : elements.slice(0, SHOWN);

  const handleReveal = useCallback(
    (usage: ElementUsage) => revealElement({ id: usage.elementId, ...chainOf(flat, usage.elementId) }),
    [flat, revealElement]
  );

  const handleExpand = useCallback(() => setExpanded(true), []);
  const handleToggle = useCallback(() => setOpen(value => !value), []);

  return (
    <section className="flex flex-col">
      <h6>
        <button
          type="button"
          aria-expanded={open}
          className="flex w-full min-w-0 cursor-pointer items-center gap-1.5 rounded px-1 pb-0.5 text-left text-[11px] font-semibold text-zinc-700 hover:bg-gray-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
          onClick={handleToggle}
        >
          <i
            className={clsx(
              'fa-solid w-2.5 shrink-0 text-center text-[8px] text-zinc-400 dark:text-zinc-500',
              open ? 'fa-chevron-down' : 'fa-chevron-right'
            )}
          />
          <i className={clsx(TREE_ICON[tree.kind], 'text-[10px] text-zinc-400 dark:text-zinc-500')} />
          <span className="truncate">{tree.label}</span>
          <span className="font-normal text-zinc-400 dark:text-zinc-500">· {elements.length}</span>
        </button>
      </h6>
      {open && shown.map(usage => <UsageElement key={usage.elementId} usage={usage} onReveal={handleReveal} />)}
      {open && shown.length < elements.length && (
        <button
          type="button"
          className="cursor-pointer self-start px-1.5 py-0.5 text-[11px] text-indigo-700 hover:underline dark:text-indigo-300"
          onClick={handleExpand}
        >
          Show all {elements.length}
        </button>
      )}
    </section>
  );
};

export default UsageTreeGroup;
