import Input from '@plitzi/plitzi-ui/Input';
import Select from '@plitzi/plitzi-ui/Select';
import { useCallback, useMemo } from 'react';

import { processTwig } from '@plitzi/sdk-shared/helpers/twigWrapper';

type SettingsProps = {
  src?: string;
  fetchPriority?: 'high' | 'low' | 'auto';
  loadMode?: 'auto' | 'lazy' | 'eager';
  variables?: Record<string, string>;
  onUpdate?: (key: string, value: string | boolean | number) => void;
};

const Settings = ({ src = '', variables, fetchPriority = 'auto', loadMode = 'auto', onUpdate }: SettingsProps) => {
  const urlPreview = useMemo(() => processTwig(src, variables, true) as string, [variables, src]);

  const handleChange = useCallback((key: string) => (value: string) => onUpdate?.(key, value), [onUpdate]);

  return (
    <div className="flex h-full flex-col gap-4 py-2">
      <div className="flex flex-col">
        <Input value={src} label="Url" onChange={handleChange('src')} size="xs" />
        {urlPreview && (
          <div className="relative mt-2 flex items-center justify-center rounded-sm border border-gray-300 p-2">
            <div className="absolute top-2 left-2 rounded-tl rounded-br border border-gray-300 bg-white p-1 text-xs">
              Preview
            </div>
            <img src={urlPreview} alt="" className="h-full w-full rounded-sm" />
          </div>
        )}
      </div>
      <Select value={fetchPriority} label="Fetch Priority" onChange={handleChange('fetchPriority')} size="xs">
        <option value="auto">Auto</option>
        <option value="high">Hight</option>
        <option value="low">Low</option>
      </Select>
      <Select value={loadMode} label="Load Mode" onChange={handleChange('loadMode')} size="xs">
        <option value="auto">Auto</option>
        <option value="lazy">Lazy</option>
        <option value="eager">Eager</option>
      </Select>
    </div>
  );
};

export default Settings;
