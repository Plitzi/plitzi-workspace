import Select from '@plitzi/plitzi-ui/Select';
import { useCallback } from 'react';

type SettingsProps = {
  subType?: 'ul' | 'ol';
  source?: 'none' | 'controlled';
  onUpdate?: (key: string, value: string | boolean | number) => void;
};

const Settings = ({ subType = 'ul', source = 'none', onUpdate }: SettingsProps) => {
  const handleChange = useCallback((key: string) => (value: string) => onUpdate?.(key, value), [onUpdate]);

  return (
    <div className="flex flex-col gap-4 py-2">
      <Select label="Source" value={source} onChange={handleChange('source')}>
        <option value="none">None</option>
        <option value="controlled">Controlled</option>
      </Select>
      {source === 'none' && (
        <Select label="List Type" value={subType} onChange={handleChange('subType')}>
          <option value="ul">Unordered</option>
          <option value="ol">Ordered</option>
        </Select>
      )}
    </div>
  );
};

export default Settings;
