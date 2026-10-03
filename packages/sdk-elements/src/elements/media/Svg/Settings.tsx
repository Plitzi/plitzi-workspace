import Input from '@plitzi/plitzi-ui/Input';
import { useCallback } from 'react';

import ElementAdvancedEditor from '../../../components/ElementAdvancedEditor';

type SettingsProps = {
  content?: string;
  label?: string;
  onUpdate?: (key: string, value: string | boolean | number) => void;
};

const Settings = ({ content = '', label = '', onUpdate }: SettingsProps) => {
  const handleChange = useCallback((key: string) => (value: string) => onUpdate?.(key, value), [onUpdate]);

  return (
    <div className="flex h-full flex-col gap-4 py-2">
      <Input
        value={label}
        label="Label"
        placeholder="What it means — empty for decoration"
        onChange={handleChange('label')}
      />
      <ElementAdvancedEditor className="grow" value={content} mode="html" onChange={handleChange('content')} />
    </div>
  );
};

export default Settings;
