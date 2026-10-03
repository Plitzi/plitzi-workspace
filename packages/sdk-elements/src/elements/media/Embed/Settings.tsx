import Input from '@plitzi/plitzi-ui/Input';
import Select from '@plitzi/plitzi-ui/Select';
import { useCallback } from 'react';

type SettingsProps = {
  src?: string;
  title?: string;
  loading?: 'lazy' | 'eager';
  allow?: string;
  sandbox?: string;
  onUpdate?: (key: string, value: string | boolean | number) => void;
};

const Settings = ({ src = '', title = '', loading = 'lazy', allow = '', sandbox = '', onUpdate }: SettingsProps) => {
  const handleChange = useCallback((key: string) => (value: string) => onUpdate?.(key, value), [onUpdate]);

  return (
    <div className="flex h-full flex-col gap-4 py-2">
      <Input value={src} label="Url" placeholder="https://…" onChange={handleChange('src')} />
      <Input value={title} label="Title" placeholder="What the frame shows" onChange={handleChange('title')} />
      <Select label="Loading" value={loading} onChange={handleChange('loading')}>
        <option value="lazy">When it is about to be seen</option>
        <option value="eager">With the page</option>
      </Select>
      <Input value={allow} label="Allow" placeholder="fullscreen; clipboard-write" onChange={handleChange('allow')} />
      <Input
        value={sandbox}
        label="Sandbox"
        placeholder="allow-scripts allow-same-origin"
        onChange={handleChange('sandbox')}
      />
    </div>
  );
};

export default Settings;
