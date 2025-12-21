import Input from '@plitzi/plitzi-ui/Input';
import Select from '@plitzi/plitzi-ui/Select';
import { useCallback } from 'react';

import type { Environment } from '@plitzi/sdk-shared';

type SettingsProps = {
  spaceKey?: string;
  environment?: Environment;
  onUpdate?: (key: string, value: string | boolean | number) => void;
};

const Settings = ({ spaceKey = '', environment = 'main', onUpdate }: SettingsProps) => {
  const handleChange = useCallback((key: string) => (value: string) => onUpdate?.(key, value), [onUpdate]);

  return (
    <div className="flex flex-col gap-4 py-2">
      <Input value={spaceKey} label="Space Key" onChange={handleChange('spaceKey')} />
      <Select value={environment} label="Environment" onChange={handleChange('environment')}>
        <option value="main">Main</option>
        <option value="development">Development</option>
        <option value="staging">Staging</option>
        <option value="production">Production</option>
      </Select>
    </div>
  );
};

export default Settings;
