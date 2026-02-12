import Checkbox from '@plitzi/plitzi-ui/Checkbox';
import Input from '@plitzi/plitzi-ui/Input';
import Select from '@plitzi/plitzi-ui/Select';
import { useCallback } from 'react';

import type { ChangeEvent } from 'react';

type SettingsProps = {
  method?: 'get' | 'post';
  managedByInteractions?: boolean;
  actionUrl?: string;
  onUpdate?: (key: string, value: string | boolean | number) => void;
};

const Settings = ({ method = 'get', managedByInteractions = false, actionUrl = '', onUpdate }: SettingsProps) => {
  const handleChangeActionUrl = useCallback((value: string) => onUpdate?.('actionUrl', value), [onUpdate]);

  const handleChangeMethod = useCallback((value: string) => onUpdate?.('method', value), [onUpdate]);

  const handleChangeManageByInteractions = useCallback(
    (e: ChangeEvent) => onUpdate?.('managedByInteractions', (e.target as HTMLInputElement).checked),
    [onUpdate]
  );

  return (
    <div className="flex h-full flex-col gap-4 py-2">
      <Select value={method} label="Form Method" onChange={handleChangeMethod} size="xs">
        <option value="get">GET</option>
        <option value="post">POST</option>
      </Select>
      <Input value={actionUrl} onChange={handleChangeActionUrl} label="Action URL" size="xs" />
      <Checkbox
        checked={managedByInteractions}
        onChange={handleChangeManageByInteractions}
        label="Managed By Interactions"
        size="xs"
      />
    </div>
  );
};

export default Settings;
