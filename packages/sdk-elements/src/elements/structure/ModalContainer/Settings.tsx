import Checkbox from '@plitzi/plitzi-ui/Checkbox';
import Input from '@plitzi/plitzi-ui/Input';
import { useCallback } from 'react';

import type { ChangeEvent } from 'react';

type SettingsProps = {
  title?: string;
  autoHideAfterClick?: boolean;
  onUpdate?: (key: string, value: string | boolean | number) => void;
};

const Settings = ({ title = 'Modal Header', autoHideAfterClick = true, onUpdate }: SettingsProps) => {
  const handleChange = useCallback((key: string) => (value: string) => onUpdate?.(key, value), [onUpdate]);

  const handleChangeAutoHide = useCallback(
    (e: ChangeEvent) => onUpdate?.('autoHideAfterClick', (e.target as HTMLInputElement).checked),
    [onUpdate]
  );

  return (
    <div className="flex flex-col gap-4 py-2">
      <Input label="Title" value={title} onChange={handleChange('title')} size="xs" />
      <Checkbox
        label="Hide after click background"
        checked={autoHideAfterClick}
        onChange={handleChangeAutoHide}
        size="xs"
      />
    </div>
  );
};

export default Settings;
