import Checkbox from '@plitzi/plitzi-ui/Checkbox';
import Input from '@plitzi/plitzi-ui/Input';

import useSettingsUpdate from '../../../useSettingsUpdate';

type SettingsProps = {
  header?: string;
  rowHeader?: boolean;
  onUpdate?: (key: string, value: string | boolean | number) => void;
};

/** A column's settings: its header, and whether its cell names its row. */
const Settings = ({ header = '', rowHeader = false, onUpdate }: SettingsProps) => {
  const update = useSettingsUpdate(onUpdate);

  return (
    <div className="flex flex-col gap-4 py-2">
      <Input value={header} label="Header" placeholder="e.g. Plan, Price" onChange={update.text('header')} size="xs" />
      <Checkbox label="Names its row" size="xs" checked={rowHeader} onChange={update.checked('rowHeader')} />
      <span className="text-ui-fg-subtle text-xs">
        On, each cell of this column is read as its row’s header — a product’s name in a comparison.
      </span>
    </div>
  );
};

export default Settings;
