import Checkbox from '@plitzi/plitzi-ui/Checkbox';
import TextArea from '@plitzi/plitzi-ui/TextArea';
import { useCallback } from 'react';

import type { ChangeEvent } from 'react';

type SettingsProps = {
  content?: string;
  headingLinks?: boolean;
  onUpdate?: (key: string, value: string | boolean | number) => void;
};

const Settings = ({ content = 'Markdown', headingLinks = true, onUpdate }: SettingsProps) => {
  const handleChangeContent = useCallback((value: string) => onUpdate?.('content', value), [onUpdate]);

  const handleChangeHeadingLinks = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => onUpdate?.('headingLinks', e.target.checked),
    [onUpdate]
  );

  return (
    <div className="flex h-full flex-col gap-4 py-2">
      <Checkbox
        checked={headingLinks}
        label="Link Each Heading To Itself"
        onChange={handleChangeHeadingLinks}
        size="xs"
      />
      <TextArea value={content} label="Content" className="h-full" onChange={handleChangeContent} />
    </div>
  );
};

export default Settings;
