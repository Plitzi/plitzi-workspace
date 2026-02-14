import TextArea from '@plitzi/plitzi-ui/TextArea';
import { useCallback } from 'react';

type SettingsProps = {
  content?: string;
  onUpdate?: (key: string, value: string | boolean | number) => void;
};

const Settings = ({ content = 'Paragraph', onUpdate }: SettingsProps) => {
  const handleChangeContent = useCallback((value: string) => onUpdate?.('content', value), [onUpdate]);

  return (
    <div className="flex h-full flex-col gap-4 py-2">
      <TextArea value={content} label="Content" className="h-full" rows={4} onChange={handleChangeContent} size="xs" />
    </div>
  );
};

export default Settings;
