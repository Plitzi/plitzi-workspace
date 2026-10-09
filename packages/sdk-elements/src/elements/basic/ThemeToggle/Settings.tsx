import Checkbox from '@plitzi/plitzi-ui/Checkbox';
import Input from '@plitzi/plitzi-ui/Input';
import Select from '@plitzi/plitzi-ui/Select';
import { useCallback } from 'react';

import type { ThemeToggleProps } from './ThemeToggle';
import type { ChangeEvent } from 'react';

type SettingsProps = Omit<ThemeToggleProps, 'ref' | 'className'> & {
  onUpdate?: (key: string, value: string | boolean | number) => void;
};

const Settings = ({
  subType = 'switch',
  lightLabel = 'Light',
  darkLabel = 'Dark',
  systemLabel = 'System',
  showSystem = false,
  onUpdate
}: SettingsProps) => {
  const handleChange = useCallback((key: string) => (value: string) => onUpdate?.(key, value), [onUpdate]);

  const handleChangeChecked = useCallback(
    (key: string) => (e: ChangeEvent<HTMLInputElement>) => onUpdate?.(key, e.target.checked),
    [onUpdate]
  );

  return (
    <div className="flex h-full flex-col gap-4 py-2">
      <Select value={subType} label="Mode" onChange={handleChange('subType')} size="xs">
        <option value="switch">Switch</option>
        <option value="segmented">Segmented</option>
      </Select>
      <Input value={lightLabel} label="Light Label" onChange={handleChange('lightLabel')} />
      <Input value={darkLabel} label="Dark Label" onChange={handleChange('darkLabel')} />
      {subType === 'segmented' && (
        <Checkbox checked={showSystem} onChange={handleChangeChecked('showSystem')} label="Offer System" />
      )}
      {subType === 'segmented' && showSystem && (
        <Input value={systemLabel} label="System Label" onChange={handleChange('systemLabel')} />
      )}
    </div>
  );
};

export default Settings;
