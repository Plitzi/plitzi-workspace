import Icon from '@plitzi/plitzi-ui/Icon';
import clsx from 'clsx';
import { memo, useCallback, useMemo } from 'react';

import CategoryOption from '../../../../components/CategoryOption';
import CategorySection from '../../../../components/CategorySection';
import { serializeLayerImage } from '../../helpers/backgroundParser';
import ConicGradientMode from '../../modes/ConicGradientMode';
import ImageMode from '../../modes/ImageMode';
import LinearGradientMode from '../../modes/LinearGradientMode';
import RadialGradientMode from '../../modes/RadialGradientMode';

import type { BackgroundLayer as BackgroundLayerType } from '../../helpers/backgroundParser';
import type { DragEvent } from 'react';

const LAYER_TYPE_LABELS: Record<BackgroundLayerType['type'], string> = {
  none: 'None',
  url: 'Image',
  'linear-gradient': 'Linear Gradient',
  'radial-gradient': 'Radial Gradient',
  'conic-gradient': 'Conic Gradient'
};

const CLIP_OPTIONS = [
  { value: 'border-box', label: 'Border Box' },
  { value: 'padding-box', label: 'Padding Box' },
  { value: 'content-box', label: 'Content Box' }
];

export type BackgroundLayerProps = {
  layer: BackgroundLayerType;
  index: number;
  expanded: boolean;
  isDragOver: boolean;
  onExpand: () => void;
  onChange: (layer: BackgroundLayerType) => void;
  onRemove: () => void;
  onDragStart: (e: DragEvent) => void;
  onDragOver: (e: DragEvent) => void;
  onDragEnd: (e: DragEvent) => void;
  onDrop: (e: DragEvent) => void;
};

const BackgroundLayer = ({
  layer,
  expanded,
  isDragOver,
  onExpand,
  onChange,
  onRemove,
  onDragStart,
  onDragOver,
  onDragEnd,
  onDrop
}: BackgroundLayerProps) => {
  const previewCSS = useMemo(() => serializeLayerImage(layer), [layer]);

  const handleTypeChange = useCallback(
    (value: unknown) => {
      const newType = String(value) as BackgroundLayerType['type'];
      onChange({ ...layer, type: newType });
    },
    [layer, onChange]
  );

  const handleClipChange = useCallback(
    (value: unknown) => onChange({ ...layer, clip: String(value) }),
    [layer, onChange]
  );

  const handleDragOver = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      onDragOver(e);
    },
    [onDragOver]
  );

  return (
    <div
      className={clsx('rounded-sm border transition-colors', {
        'border-blue-400 bg-blue-50 dark:border-blue-500 dark:bg-blue-900/20': isDragOver,
        'border-gray-200 dark:border-zinc-700': !isDragOver
      })}
      onDragOver={handleDragOver}
      onDrop={onDrop}
    >
      <div className="flex h-8 items-center gap-1 px-1">
        <span
          draggable
          className="cursor-grab px-1 text-gray-400 hover:text-gray-600 active:cursor-grabbing dark:text-zinc-500 dark:hover:text-zinc-300"
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
        >
          <Icon icon="fa-solid fa-grip-lines" size="xs" />
        </span>

        {layer.type !== 'none' && (
          <div
            className="h-4 w-4 shrink-0 rounded-sm border border-gray-300 dark:border-zinc-600"
            style={{ background: previewCSS }}
          />
        )}

        <span className="flex-1 truncate text-xs text-gray-600 dark:text-zinc-400">
          {LAYER_TYPE_LABELS[layer.type]}
        </span>

        <button
          type="button"
          className="cursor-pointer p-1 text-gray-400 hover:text-gray-600 dark:text-zinc-500 dark:hover:text-zinc-300"
          onClick={onExpand}
          title={expanded ? 'Collapse' : 'Expand'}
        >
          <Icon icon={expanded ? 'fa-solid fa-angle-up' : 'fa-solid fa-angle-down'} size="xs" />
        </button>

        <button
          type="button"
          className="cursor-pointer p-1 text-gray-400 hover:text-red-500 dark:text-zinc-500 dark:hover:text-red-400"
          onClick={onRemove}
          title="Remove layer"
        >
          <Icon icon="fas fa-times" size="xs" />
        </button>
      </div>

      {expanded && (
        <div className="flex flex-col gap-2 border-t border-gray-200 p-2 dark:border-zinc-700">
          <CategorySection label="Type">
            <CategoryOption type="select" value={layer.type} onChange={handleTypeChange}>
              <option value="linear-gradient">Linear Gradient</option>
              <option value="radial-gradient">Radial Gradient</option>
              <option value="conic-gradient">Conic Gradient</option>
              <option value="url">Image URL</option>
              <option value="none">None</option>
            </CategoryOption>
          </CategorySection>

          {layer.type === 'url' && <ImageMode layer={layer} onChange={onChange} />}
          {layer.type === 'linear-gradient' && <LinearGradientMode layer={layer} onChange={onChange} />}
          {layer.type === 'radial-gradient' && <RadialGradientMode layer={layer} onChange={onChange} />}
          {layer.type === 'conic-gradient' && <ConicGradientMode layer={layer} onChange={onChange} />}

          {layer.type !== 'none' && (
            <CategorySection label="Clip">
              <CategoryOption type="select" value={layer.clip} onChange={handleClipChange}>
                {CLIP_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </CategoryOption>
            </CategorySection>
          )}
        </div>
      )}
    </div>
  );
};

export default memo(BackgroundLayer);
