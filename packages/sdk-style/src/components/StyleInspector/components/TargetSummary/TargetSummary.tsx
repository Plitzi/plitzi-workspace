import Icon from '@plitzi/plitzi-ui/Icon';
import { memo } from 'react';

export type TargetSummaryProps = {
  selectorName?: string;
  parts: string[];
  onReset: () => void;
};

/**
 * Says what the categories below are writing to when it is not the selector's plain rules — a state, a variant, an
 * ancestor, a pseudo-element, a condition, another part — so an edit made there is never mistaken for one to the base.
 */
const TargetSummary = ({ selectorName, parts, onReset }: TargetSummaryProps) => (
  <div className="bg-primary-500/10 dark:bg-primary-400/10 flex items-center gap-2 rounded-md px-2 py-1 text-xs">
    <span className="shrink-0 text-zinc-500 dark:text-zinc-400">Editing</span>
    <span className="text-primary-700 dark:text-primary-300 min-w-0 grow truncate font-medium">
      {[selectorName, ...parts].filter(Boolean).join(' › ')}
    </span>
    <Icon
      className="shrink-0 cursor-pointer text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
      icon="fa-solid fa-xmark"
      title="Back to the selector's own rules"
      onClick={onReset}
    />
  </div>
);

export default memo(TargetSummary);
