import EffortBars from '../EffortBars';

import type { AiEffort } from '@pmodules/AI/types';

export type EffortTriggerProps = {
  value: AiEffort;
  label: string;
  disabled: boolean;
  onToggle: () => void;
};

const EffortTrigger = ({ value, label, disabled, onToggle }: EffortTriggerProps) => (
  <button
    disabled={disabled}
    onClick={onToggle}
    title={`Effort: ${label}`}
    className="flex items-center gap-1.5 rounded border border-neutral-300 bg-neutral-100 px-2 py-1 font-mono text-[9.5px] text-zinc-600 transition-colors hover:enabled:border-neutral-400 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:enabled:border-zinc-600"
  >
    <EffortBars effort={value} active />
    <span className="tracking-wider uppercase">{label}</span>
  </button>
);

export default EffortTrigger;
