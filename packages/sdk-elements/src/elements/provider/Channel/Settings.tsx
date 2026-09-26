import Input from '@plitzi/plitzi-ui/Input';
import TextArea from '@plitzi/plitzi-ui/TextArea';
import { useCallback } from 'react';

type SettingsProps = {
  topic?: string;
  keep?: number | string;
  presence?: unknown;
  onUpdate?: (key: string, value: string | boolean | number) => void;
};

const presenceText = (presence: unknown): string => {
  if (typeof presence === 'string') {
    return presence;
  }

  return presence === undefined ? '' : JSON.stringify(presence, null, 2);
};

const Settings = ({ topic = '', keep = 20, presence, onUpdate }: SettingsProps) => {
  const handleChangeTopic = useCallback((value: string) => onUpdate?.('topic', value), [onUpdate]);
  const handleChangeKeep = useCallback((value: string) => onUpdate?.('keep', Number(value) || 0), [onUpdate]);
  const handleChangePresence = useCallback((value: string) => onUpdate?.('presence', value), [onUpdate]);

  return (
    <div className="flex h-full flex-col gap-4 py-2">
      <Input value={topic} label="Topic (e.g. board:{{ id }})" onChange={handleChangeTopic} size="sm" />
      <Input value={String(keep)} label="Messages kept" onChange={handleChangeKeep} size="sm" />
      <TextArea value={presenceText(presence)} label="Presence (JSON)" onChange={handleChangePresence} />
    </div>
  );
};

export default Settings;
