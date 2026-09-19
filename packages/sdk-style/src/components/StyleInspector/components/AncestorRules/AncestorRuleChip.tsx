import clsx from 'clsx';
import { memo, useCallback } from 'react';

import type { AncestorCondition } from '../../helpers';

export type AncestorRuleChipProps = {
  condition: AncestorCondition;
  active?: boolean;
  unused?: boolean;
  onSelect?: (condition: AncestorCondition) => void;
  onRemove?: (condition: AncestorCondition) => void;
};

const AncestorRuleChip = ({ condition, active = false, unused = false, onSelect, onRemove }: AncestorRuleChipProps) => {
  const handleSelect = useCallback(() => onSelect?.(condition), [condition, onSelect]);

  const handleRemove = useCallback(() => onRemove?.(condition), [condition, onRemove]);

  const title = unused
    ? `No element this selector dresses sits inside .${condition.ancestor}, so this rule never matches`
    : `Edit the rules for inside .${condition.ancestor} (${condition.label})`;

  return (
    <div
      className={clsx('flex max-w-full items-center overflow-hidden rounded-sm border text-[11px] leading-none', {
        'border-primary-500 bg-primary-500/15 text-primary-700 dark:text-primary-200': active,
        'border-amber-500/70 bg-amber-500/10 text-amber-700 dark:text-amber-300': unused && !active,
        'border-gray-300 bg-gray-100 text-zinc-600 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300':
          !unused && !active
      })}
    >
      <button type="button" className="flex min-w-0 items-center gap-1 px-1.5 py-1" title={title} onClick={handleSelect}>
        {unused && <i className="fas fa-triangle-exclamation" />}
        <span className="truncate">.{condition.ancestor}</span>
        <span className="opacity-70">· {condition.label}</span>
      </button>
      <button
        type="button"
        className="border-l border-inherit px-1.5 py-1 hover:bg-red-500/15 hover:text-red-600 dark:hover:text-red-400"
        title="Remove this rule"
        aria-label={`Remove the ${condition.label} rule under .${condition.ancestor}`}
        onClick={handleRemove}
      >
        <i className="fas fa-xmark" />
      </button>
    </div>
  );
};

export default memo(AncestorRuleChip);
