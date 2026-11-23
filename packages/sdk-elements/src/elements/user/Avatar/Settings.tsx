import Checkbox from '@plitzi/plitzi-ui/Checkbox';
import Input from '@plitzi/plitzi-ui/Input';

import useSettingsUpdate from '../../useSettingsUpdate';

type SettingsProps = {
  src?: string;
  name?: string;
  decorative?: boolean;
  onUpdate?: (key: string, value: string | boolean | number) => void;
};

/** An avatar's settings: whose picture and name it shows, and whether a screen reader says them. */
const Settings = ({ src = '', name = '', decorative = false, onUpdate }: SettingsProps) => {
  const update = useSettingsUpdate(onUpdate);

  return (
    <div className="flex flex-col gap-4 py-2">
      <Input label="Picture" size="xs" placeholder="https://…" value={src} onChange={update.text('src')} />
      <Input
        label="Name"
        size="xs"
        placeholder="{{ auth.details.username }}"
        value={name}
        onChange={update.text('name')}
      />
      <span className="text-ui-fg-subtle text-xs">
        With no picture, or one that does not load, the initials of the name on a colour of its own.
      </span>
      <Checkbox
        label="Decorative (the name is beside it)"
        size="xs"
        checked={decorative}
        onChange={update.checked('decorative')}
      />
    </div>
  );
};

export default Settings;
