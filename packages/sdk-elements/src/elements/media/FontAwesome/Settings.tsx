import Input from '@plitzi/plitzi-ui/Input';
import Select from '@plitzi/plitzi-ui/Select';
import { useCallback } from 'react';

import IconPicker from '../../../components/IconPicker';

type SettingsProps = {
  icon?: string;
  size?: 'fa-1x' | 'fa-2x' | 'fa-3x' | 'fa-4x';
  iconAnimation?: string;
  label?: string;
  onUpdate?: (key: string, value: string | boolean | number) => void;
};

const Settings = ({ icon = '', size = 'fa-1x', iconAnimation = '', label = '', onUpdate }: SettingsProps) => {
  const handleChange = useCallback((key: string) => (value: string) => onUpdate?.(key, value), [onUpdate]);

  return (
    <div className="flex grow basis-0 flex-col gap-4 py-2">
      <Input
        value={label}
        label="Meaning"
        placeholder="Only for an icon that says something alone"
        onChange={handleChange('label')}
        size="xs"
      />
      <Select
        label="Icon Animation"
        value={iconAnimation}
        placeholder="None"
        onChange={handleChange('iconAnimation')}
        size="xs"
      >
        <option value="fa-beat">Beat</option>
        <option value="fa-fade">Fade</option>
        <option value="fa-beat-fade">Beat-Fade</option>
        <option value="fa-bounce">Bounce</option>
        <option value="fa-flip">Flip</option>
        <option value="fa-shake">Shake</option>
        <option value="fa-spin">Spin</option>
      </Select>
      <Select value={size} label="Icon Size" onChange={handleChange('size')} size="xs">
        <option value="fa-1x">1X</option>
        <option value="fa-2x">2X</option>
        <option value="fa-3x">3X</option>
        <option value="fa-4x">4X</option>
      </Select>
      <IconPicker value={icon} onChange={handleChange('icon')} />
    </div>
  );
};

export default Settings;
