import Input from '@plitzi/plitzi-ui/Input';

import ElementAdvancedEditor from '../../../components/ElementAdvancedEditor';
import useSettingsUpdate from '../../useSettingsUpdate';

type SettingsProps = {
  content?: string;
  label?: string;
  onUpdate?: (key: string, value: string | boolean | number) => void;
};

const Settings = ({ content = '', label = '', onUpdate }: SettingsProps) => {
  const update = useSettingsUpdate(onUpdate);

  return (
    <div className="flex h-full flex-col gap-4 py-2">
      <Input
        value={label}
        label="Label"
        placeholder="What it means — empty for decoration"
        onChange={update.text('label')}
      />
      <ElementAdvancedEditor className="grow" value={content} mode="html" onChange={update.text('content')} />
    </div>
  );
};

export default Settings;
