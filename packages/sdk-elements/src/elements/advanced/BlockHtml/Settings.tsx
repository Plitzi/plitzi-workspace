import { useCallback } from 'react';

import ElementAdvancedEditor from '../../../components/ElementAdvancedEditor';

type SettingsProps = {
  content?: string;
  onUpdate?: (key: string, value: string | boolean | number) => void;
};

const Settings = ({ content = '', onUpdate }: SettingsProps) => {
  const handleChangeContent = useCallback((value: string) => onUpdate?.('content', value), [onUpdate]);

  return (
    <div className="flex h-full flex-col">
      <ElementAdvancedEditor className="grow" value={content} mode="html" onChange={handleChangeContent} />
    </div>
  );
};

export default Settings;
