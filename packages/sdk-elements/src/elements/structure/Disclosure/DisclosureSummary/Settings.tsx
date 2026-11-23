import Checkbox from '@plitzi/plitzi-ui/Checkbox';

import useSettingsUpdate from '../../../useSettingsUpdate';

type SettingsProps = {
  marker?: boolean;
  onUpdate?: (key: string, value: string | boolean | number) => void;
};

/** A disclosure summary's settings: whether it draws the sign that turns as the disclosure opens. */
const Settings = ({ marker = true, onUpdate }: SettingsProps) => {
  const update = useSettingsUpdate(onUpdate);

  return (
    <div className="flex flex-col gap-4 py-2">
      <Checkbox label="Marker" size="xs" checked={marker} onChange={update.checked('marker')} />
      <span className="text-ui-fg-subtle text-xs">
        The sign at the end that turns as it opens; its look is the Marker slot. Off, put a sign of your own inside and
        turn it with the summary’s Expanded state.
      </span>
    </div>
  );
};

export default Settings;
