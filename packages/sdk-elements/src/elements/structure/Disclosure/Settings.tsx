import Checkbox from '@plitzi/plitzi-ui/Checkbox';
import Input from '@plitzi/plitzi-ui/Input';

import useSettingsUpdate from '../../useSettingsUpdate';

type SettingsProps = {
  open?: boolean;
  name?: string;
  closeOnClickOutside?: boolean;
  closeOnNavigate?: boolean;
  onUpdate?: (key: string, value: string | boolean | number) => void;
};

/** A disclosure's settings: how it starts, its group, and what closes it. */
const Settings = ({
  open = false,
  name = '',
  closeOnClickOutside = false,
  closeOnNavigate = true,
  onUpdate
}: SettingsProps) => {
  const update = useSettingsUpdate(onUpdate);

  return (
    <div className="flex flex-col gap-4 py-2">
      <Checkbox label="Starts open" size="xs" checked={open} onChange={update.checked('open')} />
      <Input label="Group" size="xs" placeholder="faq" value={name} onChange={update.text('name')} />
      <span className="text-ui-fg-subtle text-xs">
        Disclosures with the same group are an accordion: opening one closes the others. Empty, it opens on its own.
      </span>
      <Checkbox
        label="Close on a press outside"
        size="xs"
        checked={closeOnClickOutside}
        onChange={update.checked('closeOnClickOutside')}
      />
      <Checkbox
        label="Close when the page changes"
        size="xs"
        checked={closeOnNavigate}
        onChange={update.checked('closeOnNavigate')}
      />
      <span className="text-ui-fg-subtle text-xs">
        Escape always closes it. While editing the canvas shows it open; its preview opens and closes it.
      </span>
    </div>
  );
};

export default Settings;
