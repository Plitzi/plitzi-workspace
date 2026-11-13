import clsx from 'clsx';
import { useCallback, memo } from 'react';

import type { TagType } from '@plitzi/sdk-shared';
import type { MouseEvent } from 'react';

export type StyleSelectorTagProps = {
  id: string;
  label?: string;
  active?: boolean;
  checked?: boolean;
  /** Whether any row is checked: the boxes show on every row then, not only under the pointer. */
  selecting?: boolean;
  elementsCount?: number;
  /** Ancestors this selector has rules under, and how many of them no element it dresses sits inside. */
  ancestorsCount?: number;
  unusedAncestorsCount?: number;
  type?: TagType;
  onSelect?: (id: string) => void;
  onDelete?: (id: string) => void;
  onToggleCheck?: (id: string) => void;
};

/**
 * One selector of the space, as a row: what it is (an element type's defaults, or a class), its name, and what it
 * dresses — the elements wearing it, or that nothing does. Picked by a click; checked to delete several at once.
 */
const StyleSelectorTag = ({
  id,
  label = 'Selector',
  active = false,
  checked = false,
  selecting = false,
  elementsCount = 0,
  ancestorsCount = 0,
  unusedAncestorsCount = 0,
  type = 'class',
  onSelect,
  onDelete,
  onToggleCheck
}: StyleSelectorTagProps) => {
  const handleClickSelect = useCallback(() => onSelect?.(id), [id, onSelect]);

  const handleClickDelete = useCallback(
    (e: MouseEvent) => {
      e.stopPropagation();
      if (id) {
        onDelete?.(id);
      }
    },
    [id, onDelete]
  );

  const handleToggleCheck = useCallback(() => onToggleCheck?.(id), [id, onToggleCheck]);

  const handleStopPropagation = useCallback((e: MouseEvent) => e.stopPropagation(), []);

  const ancestorsTitle = unusedAncestorsCount
    ? `Rules under ${ancestorsCount} ancestor classes, ${unusedAncestorsCount} of them around no element it dresses`
    : `Rules under ${ancestorsCount} ancestor classes`;
  const element = type === 'element';

  return (
    <div
      className={clsx(
        'group relative flex h-8 shrink-0 cursor-pointer items-center gap-2 rounded-sm pr-1 pl-1.5 select-none',
        {
          'hover:bg-gray-100 dark:hover:bg-zinc-800': !active,
          'bg-primary-50 dark:bg-primary-400/15': active,
          'bg-secondary-50 dark:bg-secondary-900/30': checked && !active
        }
      )}
      aria-current={active ? 'true' : undefined}
      onClick={handleClickSelect}
    >
      {active && <span className="bg-primary-500 absolute top-1 bottom-1 left-0 w-0.5 rounded-full" />}
      <div
        className={clsx('flex w-4 shrink-0 items-center justify-center', {
          'hidden group-hover:flex': !selecting && !checked
        })}
      >
        <span className="relative flex size-3.5 items-center justify-center">
          <input
            type="checkbox"
            className="peer checked:border-primary-600 checked:bg-primary-600 size-3.5 cursor-pointer appearance-none rounded-[3px] border border-gray-400 bg-white dark:border-zinc-500 dark:bg-zinc-800"
            aria-label={`Check ${label}`}
            checked={checked}
            onChange={handleToggleCheck}
            onClick={handleStopPropagation}
          />
          <i className="fa-solid fa-check pointer-events-none absolute hidden text-[8px] text-white peer-checked:block" />
        </span>
      </div>
      <span
        className={clsx('flex w-4 shrink-0 items-center justify-center text-[11px]', {
          'group-hover:hidden': !selecting && !checked,
          hidden: selecting || checked,
          'text-primary-500 dark:text-primary-300': element,
          'font-mono font-bold text-zinc-400 dark:text-zinc-500': !element
        })}
        aria-hidden
      >
        {element ? <i className="fa-solid fa-cube" /> : '.'}
      </span>
      <span
        className={clsx('min-w-0 grow basis-0 truncate font-mono text-xs', {
          'text-primary-700 dark:text-primary-200 font-semibold': active,
          'text-zinc-800 dark:text-zinc-100': !active
        })}
        title={`${type}: ${label}`}
      >
        {label}
      </span>
      {ancestorsCount > 0 && (
        <span
          className={clsx('flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-[11px]', {
            'bg-amber-500/15 text-amber-700 dark:text-amber-300': unusedAncestorsCount > 0,
            'bg-gray-100 text-zinc-600 dark:bg-zinc-700/80 dark:text-zinc-100': unusedAncestorsCount === 0
          })}
          title={ancestorsTitle}
        >
          <i
            className={clsx('fas text-[10px]', {
              'fa-sitemap': !unusedAncestorsCount,
              'fa-triangle-exclamation': !!unusedAncestorsCount
            })}
          />
          {ancestorsCount}
        </span>
      )}
      <button
        type="button"
        className={clsx(
          'h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded text-[11px] text-zinc-400 hover:bg-red-500/10 hover:text-red-600 dark:text-zinc-500 dark:hover:text-red-400',
          { flex: active, 'hidden group-hover:flex': !active }
        )}
        title={element ? `Delete the ${label} defaults` : `Delete .${label} from the space`}
        aria-label={`Delete ${label}`}
        onClick={handleClickDelete}
      >
        <i className="fas fa-trash" />
      </button>
      {elementsCount > 0 && (
        <span
          className="min-w-6 shrink-0 rounded bg-gray-100 px-1.5 py-0.5 text-center text-[11px] font-medium text-zinc-600 tabular-nums dark:bg-zinc-700/80 dark:text-zinc-100"
          title={`Dresses ${String(elementsCount)} element${elementsCount === 1 ? '' : 's'}`}
        >
          {elementsCount}
        </span>
      )}
      {elementsCount === 0 && !element && (
        <span
          className="shrink-0 rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-300"
          title="No element wears it"
        >
          unused
        </span>
      )}
    </div>
  );
};

export default memo(StyleSelectorTag);
