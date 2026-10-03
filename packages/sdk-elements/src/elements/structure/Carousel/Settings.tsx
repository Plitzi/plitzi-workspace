import Checkbox from '@plitzi/plitzi-ui/Checkbox';
import Input from '@plitzi/plitzi-ui/Input';
import Select from '@plitzi/plitzi-ui/Select';
import { useCallback } from 'react';

import type { CarouselMode, CarouselTransition } from './CarouselContext';
import type { ChangeEvent } from 'react';

type SettingsProps = {
  mode?: CarouselMode;
  autoplay?: number;
  pauseOnHover?: boolean;
  loop?: boolean;
  transition?: CarouselTransition;
  speed?: number;
  itemKey?: string;
  label?: string;
  onUpdate?: (key: string, value: string | boolean | number) => void;
};

const Settings = ({
  mode = 'slide',
  autoplay = 0,
  pauseOnHover = true,
  loop = true,
  transition = 'slide',
  speed = 30,
  itemKey = '',
  label = '',
  onUpdate
}: SettingsProps) => {
  const handleChange = useCallback((key: string) => (value: string) => onUpdate?.(key, value), [onUpdate]);

  // An empty or unreadable number is none: 0 is what the carousel reads as "off".
  const handleChangeNumber = useCallback(
    (key: string) => (value: string) => onUpdate?.(key, Math.max(0, Math.round(Number(value) || 0))),
    [onUpdate]
  );

  const handleChangeChecked = useCallback(
    (key: string) => (e: ChangeEvent) => onUpdate?.(key, (e.target as HTMLInputElement).checked),
    [onUpdate]
  );

  return (
    <div className="flex flex-col gap-4 py-2">
      <Input label="Label" size="xs" placeholder="Featured products" value={label} onChange={handleChange('label')} />
      <Select label="Mode" value={mode} onChange={handleChange('mode')} size="xs">
        <option value="slide">One slide at a time</option>
        <option value="marquee">Marquee</option>
        <option value="scroll">Scrolling row</option>
      </Select>
      {mode === 'slide' && (
        <Select label="Transition" value={transition} onChange={handleChange('transition')} size="xs">
          <option value="slide">Slide</option>
          <option value="fade">Fade</option>
          <option value="none">None</option>
        </Select>
      )}
      {mode === 'slide' && (
        <Input
          type="number"
          label="Autoplay (ms, 0 for none)"
          size="xs"
          value={String(autoplay)}
          onChange={handleChangeNumber('autoplay')}
        />
      )}
      {mode === 'marquee' && (
        <Input
          type="number"
          label="Speed (px per second)"
          size="xs"
          value={String(speed)}
          onChange={handleChangeNumber('speed')}
        />
      )}
      <Checkbox
        checked={pauseOnHover}
        onChange={handleChangeChecked('pauseOnHover')}
        label="Pause on hover"
        size="xs"
      />
      {mode === 'slide' && <Checkbox checked={loop} onChange={handleChangeChecked('loop')} label="Loop" size="xs" />}
      <Input
        label="Row key"
        size="xs"
        placeholder="id"
        value={itemKey}
        title="The field of each item that names it, so a slide stays with its item when the items change."
        onChange={handleChange('itemKey')}
      />
    </div>
  );
};

export default Settings;
