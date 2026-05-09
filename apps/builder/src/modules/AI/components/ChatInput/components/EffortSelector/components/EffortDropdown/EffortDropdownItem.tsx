import clsx from 'clsx';
import { useCallback } from 'react';

import EffortBars from '../EffortBars';

import type { EffortOption } from '../../helpers';
import type { AiEffort } from '@pmodules/AI/types';

export type EffortDropdownItemProps = {
  opt: EffortOption;
  isSelected: boolean;
  onPick: (id: AiEffort) => void;
};

const EffortDropdownItem = ({ opt, isSelected, onPick }: EffortDropdownItemProps) => {
  const handleClick = useCallback(() => onPick(opt.id), [opt.id, onPick]);

  return (
    <button
      onClick={handleClick}
      className={clsx(
        'flex w-full items-start gap-2.5 px-3 py-2 text-left transition-colors hover:bg-neutral-50 dark:hover:bg-zinc-800',
        isSelected && 'bg-neutral-50 dark:bg-zinc-800'
      )}
    >
      <EffortBars effort={opt.id} active={isSelected} />
      <span className="min-w-0 flex-1">
        <span
          className={clsx(
            'block font-mono text-[10.5px] font-semibold tracking-wider uppercase',
            isSelected ? 'text-zinc-900 dark:text-zinc-100' : 'text-zinc-600 dark:text-zinc-400'
          )}
        >
          {opt.label}
        </span>
        <span className="block text-[10px] leading-snug text-zinc-400 dark:text-zinc-600">{opt.desc}</span>
        <span className="mt-1 flex gap-2 font-mono text-[9px] text-zinc-400 dark:text-zinc-600">
          {opt.meta.map(([k, v]) => (
            <span key={k}>
              {k} <strong className="text-zinc-500 dark:text-zinc-500">{v}</strong>
            </span>
          ))}
        </span>
      </span>
    </button>
  );
};

export default EffortDropdownItem;
