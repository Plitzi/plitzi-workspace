import Select from '@plitzi/plitzi-ui/Select';
import TextArea from '@plitzi/plitzi-ui/TextArea';
import { useCallback } from 'react';

type SettingsProps = {
  subType?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
  content?: string;
  onUpdate?: (key: string, value: string | boolean | number) => void;
};

const Settings = ({ subType = 'h1', content = '', onUpdate }: SettingsProps) => {
  const handleChange = useCallback((key: string) => (value: string) => onUpdate?.(key, value), [onUpdate]);

  return (
    <div className="flex h-full flex-col gap-4 py-2">
      <Select value={subType} label="Heading Tag" onChange={handleChange('subType')}>
        <option value="h1">H1</option>
        <option value="h2">H2</option>
        <option value="h3">H3</option>
        <option value="h4">H4</option>
        <option value="h5">H5</option>
        <option value="h6">H6</option>
      </Select>
      <TextArea value={content} label="Content" onChange={handleChange('content')} />
    </div>
  );
};

export default Settings;
