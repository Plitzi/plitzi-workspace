import Input from '@plitzi/plitzi-ui/Input';

import useSettingsUpdate from '../../useSettingsUpdate';

type SettingsProps = {
  caption?: string;
  itemKey?: string;
  onUpdate?: (key: string, value: string | boolean | number) => void;
};

/** A table's settings: what it is (its caption) and the field that names each row. Its rows come from its items. */
const Settings = ({ caption = '', itemKey = '', onUpdate }: SettingsProps) => {
  const update = useSettingsUpdate(onUpdate);

  return (
    <div className="flex flex-col gap-4 py-2">
      <Input
        value={caption}
        label="Caption"
        placeholder="e.g. Plans compared, Leads this week"
        onChange={update.text('caption')}
        size="xs"
      />
      <Input
        label="Row key"
        size="xs"
        placeholder="id"
        value={itemKey}
        title="The field of each item that names it, so a row stays with its item when the table is filtered."
        onChange={update.text('itemKey')}
      />
    </div>
  );
};

export default Settings;
