import Checkbox from '@plitzi/plitzi-ui/Checkbox';
import TextArea from '@plitzi/plitzi-ui/TextArea';
import { useCallback } from 'react';

import type { ChangeEvent } from 'react';

type SettingsProps = {
  content?: string;
  decorative?: boolean;
  onUpdate?: (key: string, value: string | boolean | number) => void;
};

const Settings = ({ content = 'Text', decorative = false, onUpdate }: SettingsProps) => {
  const handleChangeContent = useCallback((value: string) => onUpdate?.('content', value), [onUpdate]);
  const handleChangeDecorative = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => onUpdate?.('decorative', e.target.checked),
    [onUpdate]
  );

  return (
    <div className="flex h-full flex-col gap-4 py-2">
      <TextArea value={content} label="Content" className="h-full" size="xs" onChange={handleChangeContent} />
      <Checkbox
        checked={decorative}
        label="Decorative (hidden from screen readers)"
        onChange={handleChangeDecorative}
        size="xs"
      />
    </div>
  );
};

export default Settings;
