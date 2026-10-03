import Button from '@plitzi/plitzi-ui/Button';
import Select from '@plitzi/plitzi-ui/Select';
import { useCallback } from 'react';

import IconPicker from '../IconPicker';

export type IconFieldProps = {
  icon: string;
  iconPlacement: 'before' | 'after';
  onUpdate?: (key: string, value: string) => void;
};

/** A button's or a link's `icon`: which one, which side of the words, and none at all. */
const IconField = ({ icon, iconPlacement, onUpdate }: IconFieldProps) => {
  const handleChangeIcon = useCallback((value: string) => onUpdate?.('icon', value), [onUpdate]);

  const handleChangePlacement = useCallback((value: string) => onUpdate?.('iconPlacement', value), [onUpdate]);

  const handleClear = useCallback(() => onUpdate?.('icon', ''), [onUpdate]);

  return (
    <div className="flex grow basis-0 flex-col gap-4">
      <div className="flex items-end gap-2">
        <Select value={iconPlacement} label="Icon" onChange={handleChangePlacement} size="xs" className="grow">
          <option value="before">Before the words</option>
          <option value="after">After the words</option>
        </Select>
        <Button size="xs" intent="secondary" onClick={handleClear} disabled={!icon} title="No icon">
          <Button.Icon icon={icon || 'fa-solid fa-ban'} />
        </Button>
      </div>
      <IconPicker value={icon} onChange={handleChangeIcon} />
    </div>
  );
};

export default IconField;
