import Checkbox from '@plitzi/plitzi-ui/Checkbox';
import Input from '@plitzi/plitzi-ui/Input';
import { useCallback } from 'react';

import type { ChangeEvent } from 'react';

type SettingsProps = {
  src?: string;
  autoPlay?: boolean;
  playsInline?: boolean;
  loop?: boolean;
  muted?: boolean;
  onUpdate?: (key: string, value: string | boolean | number) => void;
};

const Settings = ({
  src = '',
  autoPlay = false,
  playsInline = false,
  loop = false,
  muted = true,
  onUpdate
}: SettingsProps) => {
  const handleChange = useCallback((key: string) => (value: string) => onUpdate?.(key, value), [onUpdate]);

  const handleChangeChecked = useCallback(
    (key: string) => (e: ChangeEvent) => onUpdate?.(key, (e.target as HTMLInputElement).checked),
    [onUpdate]
  );

  return (
    <div className="flex h-full flex-col gap-4 py-2">
      <div className="flex flex-col">
        <Input value={src} label="Url" onChange={handleChange('src')} />
        {src && (
          <div className="relative mt-2 flex items-center justify-center rounded-sm border border-gray-300 p-2">
            <div className="absolute top-2 left-2 rounded-tl rounded-br border border-gray-300 bg-white p-1 text-xs">
              Preview
            </div>
            <video className="h-full w-full rounded-sm" src={src} autoPlay playsInline loop muted>
              <track kind="captions" />
            </video>
          </div>
        )}
      </div>
      <Checkbox checked={autoPlay} onChange={handleChangeChecked('autoPlay')} label="Auto Play" />
      <Checkbox checked={playsInline} onChange={handleChangeChecked('playsInline')} label="Plays Inline" />
      <Checkbox label="Loop" checked={loop} onChange={handleChangeChecked('loop')} />
      <Checkbox checked={muted} onChange={handleChangeChecked('muted')} label="Muted" />
    </div>
  );
};

export default Settings;
