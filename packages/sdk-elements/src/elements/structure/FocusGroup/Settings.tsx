import Input from '@plitzi/plitzi-ui/Input';
import Select from '@plitzi/plitzi-ui/Select';

import useSettingsUpdate from '../../useSettingsUpdate';

import type { FocusGroupProps } from './FocusGroup';

type SettingsProps = {
  subType?: FocusGroupProps['subType'];
  label?: string;
  onUpdate?: (key: string, value: string | boolean | number) => void;
};

const Settings = ({ subType = 'div', label = '', onUpdate }: SettingsProps) => {
  const update = useSettingsUpdate(onUpdate);

  return (
    <div className="flex flex-col gap-4 py-2">
      <Select label="Tag" value={subType} onChange={update.text('subType')} size="xs">
        <option value="div">Div</option>
        <option value="nav">Nav</option>
        <option value="section">Section</option>
      </Select>
      <Input
        value={label}
        label="Group Name"
        placeholder="e.g. Search results, Filters"
        onChange={update.text('label')}
        size="xs"
      />
    </div>
  );
};

export default Settings;
