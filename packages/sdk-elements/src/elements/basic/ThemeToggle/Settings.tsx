import Checkbox from '@plitzi/plitzi-ui/Checkbox';
import Input from '@plitzi/plitzi-ui/Input';
import Select from '@plitzi/plitzi-ui/Select';

import useSettingsUpdate from '../../useSettingsUpdate';

import type { ThemeToggleProps } from './ThemeToggle';

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
  const update = useSettingsUpdate(onUpdate);

  return (
    <div className="flex h-full flex-col gap-4 py-2">
      <Select value={subType} label="Mode" onChange={update.text('subType')} size="xs">
        <option value="switch">Switch</option>
        <option value="segmented">Segmented</option>
      </Select>
      <Input value={lightLabel} label="Light Label" onChange={update.text('lightLabel')} />
      <Input value={darkLabel} label="Dark Label" onChange={update.text('darkLabel')} />
      {subType === 'segmented' && (
        <Checkbox checked={showSystem} onChange={update.checked('showSystem')} label="Offer System" />
      )}
      {subType === 'segmented' && showSystem && (
        <Input value={systemLabel} label="System Label" onChange={update.text('systemLabel')} />
      )}
    </div>
  );
};

export default Settings;
