import Checkbox from '@plitzi/plitzi-ui/Checkbox';
import Input from '@plitzi/plitzi-ui/Input';

import useSettingsUpdate from '../../../useSettingsUpdate';

type SettingsProps = {
  marker?: boolean;
  label?: string;
  onUpdate?: (key: string, value: string | boolean | number) => void;
};

/** A disclosure summary's settings: whether it draws the sign that turns as it opens, and its name when an icon alone. */
const Settings = ({ marker = true, label = '', onUpdate }: SettingsProps) => {
  const update = useSettingsUpdate(onUpdate);

  return (
    <div className="flex flex-col gap-4 py-2">
      <Checkbox label="Marker" size="xs" checked={marker} onChange={update.checked('marker')} />
      <span className="text-ui-fg-subtle text-xs">
        The sign at the end that turns as it opens; its look is the Marker slot. Off, put a sign of your own inside and
        turn it with the summary’s Expanded state.
      </span>
      <Input
        value={label}
        label="Accessible Name"
        placeholder="For an icon alone: a menu’s burger"
        onChange={update.text('label')}
        size="sm"
      />
    </div>
  );
};

export default Settings;
