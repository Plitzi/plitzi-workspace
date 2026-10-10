import Input from '@plitzi/plitzi-ui/Input';
import Select from '@plitzi/plitzi-ui/Select';

import useSettingsUpdate from '../../useSettingsUpdate';

import type { Environment } from '@plitzi/sdk-shared';

type SettingsProps = {
  spaceKey?: string;
  environment?: Environment;
  onUpdate?: (key: string, value: string | boolean | number) => void;
};

const Settings = ({ spaceKey = '', environment = 'main', onUpdate }: SettingsProps) => {
  const update = useSettingsUpdate(onUpdate);

  return (
    <div className="flex flex-col gap-4 py-2">
      <Input value={spaceKey} label="Space Key" onChange={update.text('spaceKey')} />
      <Select value={environment} label="Environment" onChange={update.text('environment')}>
        <option value="main">Main</option>
        <option value="development">Development</option>
        <option value="staging">Staging</option>
        <option value="production">Production</option>
      </Select>
      <p className="text-xs">
        Or bind <code>offlineData</code> to a space&#39;s documents — an API&#39;s answer, a runtime&#39;s route — or
        <code>offlineData.schema</code> and <code>offlineData.style</code> from two elements, to draw it with no
        backend; the key is then not read.
      </p>
    </div>
  );
};

export default Settings;
