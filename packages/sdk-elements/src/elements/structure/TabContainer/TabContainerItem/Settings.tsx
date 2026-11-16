import Input from '@plitzi/plitzi-ui/Input';

import useSettingsUpdate from '../../../useSettingsUpdate';

type SettingsProps = {
  hash?: string;
  onUpdate?: (key: string, value: string | boolean | number) => void;
};

/** A tab's settings: the address hash that opens it (`#domains`), which choosing it writes. */
const Settings = ({ hash = '', onUpdate }: SettingsProps) => {
  const update = useSettingsUpdate(onUpdate);

  return (
    <div className="flex flex-col gap-4 py-2">
      <Input value={hash} label="Address hash" placeholder="domains" onChange={update.text('hash')} size="xs" />
      <span className="text-ui-fg-subtle text-xs">
        A link to the page ending in #{hash || 'domains'} opens on this tab, and choosing the tab writes it in the
        address. Set it on the header’s tab.
      </span>
    </div>
  );
};

export default Settings;
