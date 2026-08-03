import Input from '@plitzi/plitzi-ui/Input';
import Select from '@plitzi/plitzi-ui/Select';
import { useCallback } from 'react';

type SettingsProps = {
  format?: 'html' | 'markdown' | 'text';
  mediaBaseUrl?: string;
  onUpdate?: (key: string, value: string | boolean | number | object) => void;
};

const Settings = ({ format = 'html', mediaBaseUrl = '', onUpdate }: SettingsProps) => {
  const handleChange = useCallback((key: string) => (value: string) => onUpdate?.(key, value), [onUpdate]);

  return (
    <div className="flex grow flex-col gap-4 py-2">
      <Select value={format} label="Content Format" onChange={handleChange('format')} size="xs">
        <option value="html">HTML</option>
        <option value="markdown">Markdown</option>
        <option value="text">Plain text</option>
      </Select>
      <Input
        value={mediaBaseUrl}
        label="Media Base URL"
        placeholder="https://cms.example.com"
        title="Prefix for relative image and link paths inside the body."
        onChange={handleChange('mediaBaseUrl')}
        size="xs"
      />
      <span className="text-xs text-gray-500">
        Bind <strong>content</strong> to the body field of your record. Scripts, event handlers and javascript: URLs are
        removed before rendering.
      </span>
    </div>
  );
};

export default Settings;
