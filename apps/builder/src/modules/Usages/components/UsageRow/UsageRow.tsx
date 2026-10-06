import clsx from 'clsx';
import { memo, useCallback, useMemo } from 'react';

import UsageOwner from './components/UsageOwner';
import UsageReferences from './components/UsageReferences';
import UsageTreeGroup from './components/UsageTreeGroup';
import { groupByTree, usageCount, usageSummary } from '../../helpers/grouping';
import { isUnused } from '../../helpers/usageIndex';

import type { UsageCategory, UsageItem } from '../../helpers/usageIndex';

export type UsageRowProps = {
  item: UsageItem;
  category: UsageCategory;
  open: boolean;
  /** Said under the name when nothing uses it. */
  unusedText: string;
  onToggle: (key: string) => void;
};

/** One declared thing: its name and how much uses it, opened onto where — each element a link to it. */
const UsageRow = ({ item, category, open, unusedText, onToggle }: UsageRowProps) => {
  const unused = isUnused(item);
  const groups = useMemo(() => (open ? groupByTree(item.elements) : []), [item.elements, open]);

  const handleToggle = useCallback(() => onToggle(item.key), [item.key, onToggle]);

  return (
    <div className="border-b border-zinc-100 last:border-b-0 dark:border-zinc-800">
      <button
        type="button"
        aria-expanded={open}
        className="flex w-full min-w-0 cursor-pointer items-center gap-2 rounded px-1 py-1.5 text-left hover:bg-gray-100 dark:hover:bg-zinc-800"
        onClick={handleToggle}
      >
        <i
          className={clsx('fa-solid w-3 shrink-0 text-center text-[9px] text-zinc-400 dark:text-zinc-500', {
            'fa-chevron-down': open,
            'fa-chevron-right': !open
          })}
        />
        <span className="min-w-0 grow basis-0 truncate font-mono text-xs text-zinc-800 dark:text-zinc-100">
          {item.name}
        </span>
        {item.detail && item.detail !== item.name && (
          <span className="max-w-[40%] shrink-0 truncate text-[10px] text-zinc-500 dark:text-zinc-400">
            {item.detail}
          </span>
        )}
        {unused && (
          <span className="shrink-0 rounded bg-yellow-100 px-1.5 text-[10px] font-medium text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300">
            unused
          </span>
        )}
        {!unused && (
          <span
            className="min-w-5 shrink-0 rounded bg-zinc-100 px-1.5 text-center text-[10px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
            title={usageSummary(item.elements, item.references)}
          >
            {usageCount(item)}
          </span>
        )}
      </button>
      {open && (
        <div className="flex flex-col gap-2 pt-1 pr-1 pb-2 pl-6">
          {item.owner && <UsageOwner owner={item.owner} opensComponent={category === 'components'} />}
          {unused && <p className="text-[11px] leading-relaxed text-yellow-700 dark:text-yellow-400">{unusedText}</p>}
          {item.references.length > 0 && <UsageReferences references={item.references} />}
          {item.elements.length > 0 && (
            <span className="text-[10px] tracking-wider text-zinc-500 uppercase dark:text-zinc-400">
              {usageSummary(item.elements, item.references)}
            </span>
          )}
          {groups.map(group => (
            <UsageTreeGroup key={`${group.tree.kind}:${group.tree.id}`} group={group} />
          ))}
        </div>
      )}
    </div>
  );
};

export default memo(UsageRow);
