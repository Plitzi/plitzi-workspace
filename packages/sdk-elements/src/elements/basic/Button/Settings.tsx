import Checkbox from '@plitzi/plitzi-ui/Checkbox';
import Input from '@plitzi/plitzi-ui/Input';
import Select from '@plitzi/plitzi-ui/Select';
import { useCallback } from 'react';

import type { ChangeEvent } from 'react';

type SettingsProps = {
  content?: string;
  contentPlacement?: 'before' | 'after' | 'elements';
  subType?: 'button' | 'reset' | 'submit';
  disabled?: boolean;
  onUpdate?: (key: string, value: string | number | boolean) => void;
};

const Settings = ({
  content = 'Button',
  contentPlacement = 'after',
  subType = 'button',
  disabled = false,
  onUpdate
}: SettingsProps) => {
  const handleChangeContent = useCallback((value: string) => onUpdate?.('content', value), [onUpdate]);

  const handleChangeContentPlacement = useCallback(
    (value: string) => onUpdate?.('contentPlacement', value),
    [onUpdate]
  );

  const handleChangeSubType = useCallback((value: string) => onUpdate?.('subType', value), [onUpdate]);

  const handleChangeDisabled = useCallback(
    (e: ChangeEvent) => onUpdate?.('disabled', (e.target as HTMLInputElement).checked),
    [onUpdate]
  );

  return (
    <div className="flex h-full flex-col gap-4 py-2">
      <Input value={content} label="Content" onChange={handleChangeContent} />
      <Select value={contentPlacement} label="Mode" onChange={handleChangeContentPlacement}>
        <option value="before">Before Elements</option>
        <option value="after">After Elements</option>
        <option value="elements">Only Elements</option>
      </Select>
      <Select value={subType} label="Button Type" onChange={handleChangeSubType}>
        <option value="button">Button</option>
        <option value="submit">Submit</option>
        <option value="reset">Reset</option>
      </Select>
      <Checkbox checked={disabled} label="Is Disabled" onChange={handleChangeDisabled} />
    </div>
  );
};

export default Settings;
