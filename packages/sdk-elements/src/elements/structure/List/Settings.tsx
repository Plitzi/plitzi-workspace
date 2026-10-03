import Input from '@plitzi/plitzi-ui/Input';
import Select from '@plitzi/plitzi-ui/Select';
import { useCallback } from 'react';

type SettingsProps = {
  subType?: 'ul' | 'ol';
  source?: 'none' | 'controlled';
  itemKey?: string;
  onUpdate?: (key: string, value: string | boolean | number) => void;
};

const Settings = ({ subType = 'ul', source = 'none', itemKey = '', onUpdate }: SettingsProps) => {
  const handleChange = useCallback((key: string) => (value: string) => onUpdate?.(key, value), [onUpdate]);

  return (
    <div className="flex flex-col gap-4 py-2">
      <Select label="Source" value={source} onChange={handleChange('source')} size="xs">
        <option value="none">None</option>
        <option value="controlled">Controlled</option>
      </Select>
      {source === 'controlled' && (
        <Input
          label="Row key"
          size="xs"
          placeholder="id"
          value={itemKey}
          title="The field of each item that names it, so a row stays with its item when the list is filtered."
          onChange={handleChange('itemKey')}
        />
      )}
      {source === 'none' && (
        <Select label="List Type" value={subType} onChange={handleChange('subType')} size="xs">
          <option value="ul">Unordered</option>
          <option value="ol">Ordered</option>
        </Select>
      )}
    </div>
  );
};

export default Settings;
