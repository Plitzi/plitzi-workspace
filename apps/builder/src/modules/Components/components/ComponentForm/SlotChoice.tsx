import Checkbox from '@plitzi/plitzi-ui/Checkbox';
import { useCallback } from 'react';

import type { ChangeEvent } from 'react';

export type SlotChoiceProps = {
  id: string;
  label: string;
  checked: boolean;
  onToggle: (id: string, checked: boolean) => void;
};

const SlotChoice = ({ id, label, checked, onToggle }: SlotChoiceProps) => {
  const handleChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => onToggle(id, event.target.checked),
    [id, onToggle]
  );

  return (
    <Checkbox
      checked={checked}
      onChange={handleChange}
      size="xs"
      label={
        <span className="flex items-baseline gap-1.5">
          {label}
          <span className="font-mono text-[11px] text-gray-500 dark:text-zinc-400">{id}</span>
        </span>
      }
    />
  );
};

export default SlotChoice;
