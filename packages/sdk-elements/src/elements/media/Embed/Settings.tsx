import Input from '@plitzi/plitzi-ui/Input';
import Select from '@plitzi/plitzi-ui/Select';

import useSettingsUpdate from '../../useSettingsUpdate';

type SettingsProps = {
  src?: string;
  title?: string;
  loading?: 'lazy' | 'eager';
  allow?: string;
  sandbox?: string;
  onUpdate?: (key: string, value: string | boolean | number) => void;
};

const Settings = ({ src = '', title = '', loading = 'lazy', allow = '', sandbox = '', onUpdate }: SettingsProps) => {
  const update = useSettingsUpdate(onUpdate);

  return (
    <div className="flex h-full flex-col gap-4 py-2">
      <Input value={src} label="Url" placeholder="https://…" onChange={update.text('src')} />
      <Input value={title} label="Title" placeholder="What the frame shows" onChange={update.text('title')} />
      <Select label="Loading" value={loading} onChange={update.text('loading')}>
        <option value="lazy">When it is about to be seen</option>
        <option value="eager">With the page</option>
      </Select>
      <Input value={allow} label="Allow" placeholder="fullscreen; clipboard-write" onChange={update.text('allow')} />
      <Input
        value={sandbox}
        label="Sandbox"
        placeholder="allow-scripts allow-same-origin"
        onChange={update.text('sandbox')}
      />
    </div>
  );
};

export default Settings;
