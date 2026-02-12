// import Select from '@plitzi/plitzi-ui/Select';
// import { useCallback } from 'react';

// type SettingsProps = {
// subType?: 'ul' | 'ol';
// source?: 'none' | 'controlled';
// onUpdate?: (key: string, value: string | boolean | number) => void;
// };

// { subType = 'ul', source = 'none', onUpdate }: SettingsProps
const Settings = () => {
  // const handleChange = useCallback((key: string) => (value: string) => onUpdate?.(key, value), [onUpdate]);

  return (
    <div className="flex flex-col gap-4">
      {/* <Select label="Source" value={source} onChange={handleChange('source')} size="xs">
        <option value="none">None</option>
        <option value="controlled">Controlled</option>
      </Select>
      {source === 'none' && (
        <Select label="List Type" value={subType} onChange={handleChange('subType')} size="xs">
          <option value="ul">Unordered</option>
          <option value="ol">Ordered</option>
        </Select>
      )} */}
    </div>
  );
};

export default Settings;
