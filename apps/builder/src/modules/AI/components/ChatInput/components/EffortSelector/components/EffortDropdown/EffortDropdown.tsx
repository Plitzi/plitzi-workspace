import EffortDropdownItem from './EffortDropdownItem';
import { OPTIONS } from '../../helpers';

import type { AiEffort } from '@pmodules/AI/types';

export type EffortDropdownProps = {
  value: AiEffort;
  onPick: (id: AiEffort) => void;
};

const EffortDropdown = ({ value, onPick }: EffortDropdownProps) => (
  <div className="absolute bottom-full left-0 z-50 mb-1.5 w-52 overflow-hidden rounded-xl border border-neutral-300 bg-white shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
    <div className="px-3 pt-2.5 pb-1 font-mono text-[9px] tracking-widest text-zinc-400 uppercase dark:text-zinc-600">
      Reasoning effort
    </div>
    {OPTIONS.map(opt => (
      <EffortDropdownItem key={opt.id} opt={opt} isSelected={opt.id === value} onPick={onPick} />
    ))}
  </div>
);

export default EffortDropdown;
