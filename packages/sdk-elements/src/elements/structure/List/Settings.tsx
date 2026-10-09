import Input from '@plitzi/plitzi-ui/Input';
import Select from '@plitzi/plitzi-ui/Select';

import useSettingsUpdate from '../../useSettingsUpdate';

type SettingsProps = {
  subType?: 'ul' | 'ol';
  source?: 'none' | 'controlled';
  itemKey?: string;
  label?: string;
  onUpdate?: (key: string, value: string | boolean | number) => void;
};

const Settings = ({ subType = 'ul', source = 'none', itemKey = '', label = '', onUpdate }: SettingsProps) => {
  const update = useSettingsUpdate(onUpdate);

  return (
    <div className="flex flex-col gap-4 py-2">
      <Select label="Source" value={source} onChange={update.text('source')} size="xs">
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
          onChange={update.text('itemKey')}
        />
      )}
      <Select label="List Type" value={subType} onChange={update.text('subType')} size="xs">
        <option value="ul">Unordered</option>
        <option value="ol">Ordered</option>
      </Select>
      <Input
        value={label}
        label="List Name"
        placeholder="e.g. Kinds of capsule, Search results"
        onChange={update.text('label')}
        size="xs"
      />
    </div>
  );
};

export default Settings;
