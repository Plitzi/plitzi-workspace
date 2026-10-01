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
    (event: ChangeEvent) => onToggle(id, (event.target as HTMLInputElement).checked),
    [id, onToggle]
  );

  return <Checkbox checked={checked} onChange={handleChange} label={`${label} (${id})`} size="xs" />;
};

export default SlotChoice;
