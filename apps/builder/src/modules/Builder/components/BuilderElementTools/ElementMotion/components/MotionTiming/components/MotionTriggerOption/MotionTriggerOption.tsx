import clsx from 'clsx';
import { useCallback } from 'react';

import type { MotionTrigger } from '@plitzi/sdk-shared/schema';

export type MotionTriggerOptionProps = {
  trigger: MotionTrigger;
  label: string;
  selected: boolean;
  onSelect: (trigger: MotionTrigger) => void;
};

const MotionTriggerOption = ({ trigger, label, selected, onSelect }: MotionTriggerOptionProps) => {
  const handleSelect = useCallback(() => onSelect(trigger), [onSelect, trigger]);

  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      className={clsx('grow cursor-pointer rounded px-2 py-1 text-xs transition-colors', {
        'bg-ui-active text-ui-fg font-medium shadow-sm': selected,
        'text-ui-fg-subtle hover:text-ui-fg': !selected
      })}
      onClick={handleSelect}
    >
      {label}
    </button>
  );
};

export default MotionTriggerOption;
