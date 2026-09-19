import Button from '@plitzi/plitzi-ui/Button';
import Checkbox from '@plitzi/plitzi-ui/Checkbox';
import clsx from 'clsx';
import { useCallback, memo } from 'react';

import SelectorItem from '../Selector/SelectorItem';

import type { TagType } from '@plitzi/sdk-shared';
import type { MouseEvent } from 'react';

export type StyleSelectorTagProps = {
  id: string;
  label?: string;
  active?: boolean;
  checked?: boolean;
  elementsCount?: number;
  /** Ancestors this selector has rules under, and how many of them no element it dresses sits inside. */
  ancestorsCount?: number;
  unusedAncestorsCount?: number;
  type?: TagType;
  onSelect?: (id: string) => void;
  onDelete?: (id: string) => void;
  onToggleCheck?: (id: string) => void;
};

const StyleSelectorTag = ({
  id,
  label = 'Selector',
  active = false,
  checked = false,
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

  return (
    <div
      className={clsx(
        'group flex cursor-pointer items-center justify-between gap-2 border-t border-gray-300 p-1 dark:border-zinc-700',
        {
          'hover:bg-gray-100 dark:hover:bg-zinc-700/60': !active && !checked,
          'bg-gray-200 dark:bg-zinc-700': active,
          'bg-secondary-50 dark:bg-secondary-900/30': checked && !active
        }
      )}
      onClick={handleClickSelect}
    >
      <div className="flex min-w-0 items-center gap-2">
        <div className="flex items-center">
          <Checkbox size="xs" checked={checked} onChange={handleToggleCheck} onClick={handleStopPropagation} />
        </div>
        <SelectorItem editable={false} selector={label} type={type} active readOnly />
      </div>
      <div className="flex items-center">
        {ancestorsCount > 0 && (
          <div
            className={clsx('mr-1 flex items-center gap-1 rounded-sm px-1.5 py-1 text-xs', {
              'bg-amber-500/15 text-amber-700 dark:text-amber-300': unusedAncestorsCount > 0,
              'bg-gray-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300': unusedAncestorsCount === 0
            })}
            title={ancestorsTitle}
          >
            <i className={clsx('fas', { 'fa-sitemap': !unusedAncestorsCount, 'fa-triangle-exclamation': !!unusedAncestorsCount })} />
            {ancestorsCount}
          </div>
        )}
        <div className={clsx('mr-1', { flex: active, 'hidden group-hover:flex': !active })}>
          <Button intent="danger" size="xs" onClick={handleClickDelete}>
            <Button.Icon icon="fas fa-trash" />
          </Button>
        </div>
        {elementsCount > 0 && (
          <div className="bg-secondary-400 flex items-center justify-center rounded-sm px-1.5 py-1 text-xs text-white">
            {elementsCount}
          </div>
        )}
      </div>
    </div>
  );
};

export default memo(StyleSelectorTag);
