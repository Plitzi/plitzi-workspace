import { get } from '@plitzi/plitzi-ui/helpers';
import clsx from 'clsx';
import { use, useCallback } from 'react';

import ComponentContext from '@plitzi/sdk-shared/elements/ComponentContext';

import type { ElementUsage } from '../../../../helpers/usageIndex';

export type UsageElementProps = {
  usage: ElementUsage;
  onReveal: (usage: ElementUsage) => void;
};

/** An element that uses the item, and how: a link that takes the author to it. */
const UsageElement = ({ usage, onReveal }: UsageElementProps) => {
  const { componentDefinitions } = use(ComponentContext);
  const via = usage.via.join(' · ');

  const handleClick = useCallback(() => onReveal(usage), [onReveal, usage]);

  return (
    <button
      type="button"
      title={`Select ${usage.elementId}${via ? ` — ${via}` : ''}`}
      className="flex w-full min-w-0 cursor-pointer items-center gap-2 rounded px-1.5 py-0.5 text-left hover:bg-indigo-50 dark:hover:bg-zinc-800"
      onClick={handleClick}
    >
      <i
        className={clsx(
          get(componentDefinitions.current, `${usage.elementType}.market.icon`, 'fa-solid fa-shapes'),
          'w-3 shrink-0 text-center text-[11px] text-zinc-400 dark:text-zinc-500'
        )}
      />
      <span className="min-w-0 shrink truncate font-mono text-[11px] text-indigo-700 dark:text-indigo-300">
        {usage.elementId}
        {usage.label && <span className="font-sans text-zinc-500 dark:text-zinc-400"> · {usage.label}</span>}
      </span>
      {via && (
        <span className="ml-auto min-w-0 shrink-[2] truncate font-mono text-[11px] text-zinc-400 dark:text-zinc-500">
          {via}
        </span>
      )}
    </button>
  );
};

export default UsageElement;
