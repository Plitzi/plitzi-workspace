import Checkbox from '@plitzi/plitzi-ui/Checkbox';
import Input from '@plitzi/plitzi-ui/Input';
import Select from '@plitzi/plitzi-ui/Select';
import { useCallback, useMemo } from 'react';

import { processTwig } from '@plitzi/sdk-shared/helpers/twigWrapper';

import type { ChangeEvent } from 'react';

type SettingsProps = {
  src?: string;
  alt?: string;
  decorative?: boolean;
  fetchPriority?: 'high' | 'low' | 'auto';
  loadMode?: 'auto' | 'lazy' | 'eager';
  sizes?: string;
  width?: number;
  height?: number;
  variables?: Record<string, string>;
  onUpdate?: (key: string, value: string | boolean | number) => void;
};

const Settings = ({
  src = '',
  alt = '',
  decorative = false,
  variables,
  fetchPriority = 'auto',
  loadMode = 'auto',
  sizes = '100vw',
  width,
  height,
  onUpdate
}: SettingsProps) => {
  const urlPreview = useMemo(() => processTwig(src, variables, true) as string, [variables, src]);

  const handleChange = useCallback((key: string) => (value: string) => onUpdate?.(key, value), [onUpdate]);

  // An empty field is no size at all: 0 is what the element reads as "not given".
  const handleChangeNumber = useCallback(
    (key: string) => (value: string) => onUpdate?.(key, Math.max(0, Math.round(Number(value) || 0))),
    [onUpdate]
  );

  const handleChangeDecorative = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => onUpdate?.('decorative', e.target.checked),
    [onUpdate]
  );

  return (
    <div className="flex h-full flex-col gap-4 py-2">
      <div className="flex flex-col">
        <Input value={src} label="Url" onChange={handleChange('src')} size="xs" />
        {urlPreview && (
          <div className="relative mt-2 flex items-center justify-center rounded-sm border border-gray-300 p-2">
            <div className="absolute top-2 left-2 rounded-tl rounded-br border border-gray-300 bg-white p-1 text-xs">
              Preview
            </div>
            <img src={urlPreview} alt="" className="h-full w-full rounded-sm" />
          </div>
        )}
      </div>
      {!decorative && (
        <Input
          value={alt}
          label="Alt Text"
          placeholder="What the picture shows, for who cannot see it"
          onChange={handleChange('alt')}
          size="xs"
        />
      )}
      <Checkbox
        checked={decorative}
        label="Decorative (nothing to describe)"
        onChange={handleChangeDecorative}
        size="xs"
      />
      <Select value={fetchPriority} label="Fetch Priority" onChange={handleChange('fetchPriority')} size="xs">
        <option value="auto">Auto</option>
        <option value="high">Hight</option>
        <option value="low">Low</option>
      </Select>
      <Select value={loadMode} label="Load Mode" onChange={handleChange('loadMode')} size="xs">
        <option value="auto">Auto</option>
        <option value="lazy">Lazy</option>
        <option value="eager">Eager</option>
      </Select>
      <Input
        value={sizes}
        label="Sizes"
        placeholder="(max-width: 48rem) 100vw, 360px"
        onChange={handleChange('sizes')}
        size="xs"
      />
      <div className="flex gap-2">
        <Input
          type="number"
          value={width ? String(width) : ''}
          label="Width (px)"
          onChange={handleChangeNumber('width')}
          size="xs"
        />
        <Input
          type="number"
          value={height ? String(height) : ''}
          label="Height (px)"
          onChange={handleChangeNumber('height')}
          size="xs"
        />
      </div>
    </div>
  );
};

export default Settings;
