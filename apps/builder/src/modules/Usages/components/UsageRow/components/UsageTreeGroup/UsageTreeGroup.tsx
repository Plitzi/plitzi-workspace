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
};

/** The uses in one page, layout or component, under its name. */
const UsageTreeGroup = ({ group }: UsageTreeGroupProps) => {
  const { tree, elements } = group;
  const [flat] = useBuilderStore('schema.flat');
  const revealElement = useRevealElement();
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? elements : elements.slice(0, SHOWN);

  const handleReveal = useCallback(
    (usage: ElementUsage) => revealElement({ id: usage.elementId, ...chainOf(flat, usage.elementId) }),
    [flat, revealElement]
  );

  const handleExpand = useCallback(() => setExpanded(true), []);

  return (
    <section className="flex flex-col">
      <h6 className="flex min-w-0 items-center gap-1.5 px-1 pb-0.5 text-[11px] font-semibold text-zinc-700 dark:text-zinc-200">
        <i className={clsx(TREE_ICON[tree.kind], 'text-[10px] text-zinc-400 dark:text-zinc-500')} />
        <span className="truncate">{tree.label}</span>
        <span className="font-normal text-zinc-400 dark:text-zinc-500">· {elements.length}</span>
      </h6>
      {shown.map(usage => (
        <UsageElement key={usage.elementId} usage={usage} onReveal={handleReveal} />
      ))}
      {shown.length < elements.length && (
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
