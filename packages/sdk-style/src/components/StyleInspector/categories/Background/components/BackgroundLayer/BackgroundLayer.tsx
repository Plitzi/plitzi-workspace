import Switch from '@plitzi/plitzi-ui/Switch';
import clsx from 'clsx';
import { memo, useCallback, useMemo, useState } from 'react';

import { nodeOf } from '@plitzi/sdk-shared/helpers/eventTarget';

import { CLIP_OPTIONS, isGradient, LAYER_TYPE_LABELS, LAYER_TYPES, layerSummary } from './helpers';
import CategoryOption from '../../../../components/CategoryOption';
import CategorySection from '../../../../components/CategorySection';
import ColorSwatch from '../../../../components/ColorSwatch';
import { asText } from '../../../../cssValues';
import { serializeLayerImage } from '../../helpers/backgroundParser';
import ConicGradientMode from '../../modes/ConicGradientMode';
import ImageMode from '../../modes/ImageMode';
import LinearGradientMode from '../../modes/LinearGradientMode';
import RadialGradientMode from '../../modes/RadialGradientMode';
import RawMode from '../../modes/RawMode';
import BackgroundAttachment from '../BackgroundAttachment';
import BackgroundPosition from '../BackgroundPosition';
import BackgroundSize from '../BackgroundSize';
import BackgroundTile from '../BackgroundTile';
import LayerGroup from '../LayerGroup';

import type { BackgroundLayer as BackgroundLayerType } from '../../helpers/backgroundParser';
import type { StyleCategory, StyleValue } from '@plitzi/sdk-shared';
import type { ChangeEvent, DragEvent, KeyboardEvent, MouseEvent } from 'react';

export type BackgroundLayerProps = {
  layer: BackgroundLayerType;
  index: number;
  expanded: boolean;
  onExpand: (id: string) => void;
  onChange: (layer: BackgroundLayerType) => void;
  onRemove: () => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
};

type OptionValue = StyleValue | Record<StyleCategory, StyleValue> | boolean;

/**
 * One layer of a background: a row that previews it and names it — dragged to reorder, pressed to open — and, open,
 * its editor in two halves: what it draws, then where it goes.
 */
const BackgroundLayer = ({ layer, index, expanded, onExpand, onChange, onRemove, onReorder }: BackgroundLayerProps) => {
  const [isDragOver, setIsDragOver] = useState(false);

  const preview = useMemo(() => serializeLayerImage(layer), [layer]);

  const handleTypeChange = useCallback(
    (value: OptionValue) => {
      const type = LAYER_TYPES.find(candidate => candidate === asText(value));
      if (type) {
        onChange({ ...layer, type });
      }
    },
    [layer, onChange]
  );

  const handleRepeatingChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => onChange({ ...layer, repeating: e.target.checked }),
    [layer, onChange]
  );

  const handleClipChange = useCallback(
    (value: OptionValue) => onChange({ ...layer, clip: asText(value) }),
    [layer, onChange]
  );

  const handleExpand = useCallback(() => onExpand(layer.id), [onExpand, layer.id]);

  const handleKeyDownRow = useCallback(
    (e: KeyboardEvent) => {
      if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        onExpand(layer.id);
      }
    },
    [onExpand, layer.id]
  );

  // Grabbing the handle to drag is not a press of the row.
  const handleClickHandle = useCallback((e: MouseEvent) => e.stopPropagation(), []);

  const handleRemove = useCallback(
    (e: MouseEvent) => {
      // The row opens the layer; removing must not open it on the way out.
      e.stopPropagation();
      onRemove();
    },
    [onRemove]
  );

  const handleDragStart = useCallback(
    (e: DragEvent) => {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', String(index));
    },
    [index]
  );

  const handleDragEnd = useCallback(() => setIsDragOver(false), []);

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent) => {
    if (!e.currentTarget.contains(nodeOf(e.relatedTarget))) {
      setIsDragOver(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const fromIndex = parseInt(e.dataTransfer.getData('text/plain'), 10);
      if (!isNaN(fromIndex)) {
        onReorder(fromIndex, index);
      }
    },
    [index, onReorder]
  );

  const gradient = isGradient(layer.type);
  const placed = layer.type !== 'none';

  return (
    <div
      className={clsx('rounded-md border transition-colors duration-150', {
        'border-primary-500 bg-primary-500/5 dark:border-primary-400 dark:bg-primary-400/10': isDragOver,
        'border-primary-500/60 dark:border-primary-400/60': expanded && !isDragOver,
        'border-gray-200 dark:border-zinc-700': !expanded && !isDragOver
      })}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div
        className="group flex h-8 cursor-pointer items-center gap-2 px-1.5 select-none"
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        onClick={handleExpand}
        onKeyDown={handleKeyDownRow}
      >
        <span
          draggable
          className="flex h-5 w-4 cursor-grab items-center justify-center text-zinc-400 hover:text-zinc-700 active:cursor-grabbing dark:text-zinc-500 dark:hover:text-zinc-200"
          title="Drag to reorder — the first layer is drawn on top"
          onClick={handleClickHandle}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <i className="fa-solid fa-grip-vertical text-xs" />
        </span>
        <ColorSwatch className="h-5 w-5" value={preview} property="background" />
        <span className="min-w-0 grow truncate text-xs text-zinc-700 dark:text-zinc-200" title={layerSummary(layer)}>
          {layerSummary(layer)}
        </span>
        <i
          className={clsx('fa-solid text-xs text-zinc-400 dark:text-zinc-500', {
            'fa-angle-up': expanded,
            'fa-angle-down': !expanded
          })}
        />
        <button
          type="button"
          className="flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded text-zinc-400 hover:bg-red-500/10 hover:text-red-600 dark:text-zinc-500 dark:hover:text-red-400"
          title="Remove layer"
          aria-label="Remove layer"
          onClick={handleRemove}
        >
          <i className="fa-solid fa-xmark text-xs" />
        </button>
      </div>
      {expanded && (
        <div className="flex flex-col gap-4 border-t border-gray-200 p-2.5 dark:border-zinc-700">
          <LayerGroup title={gradient ? 'Gradient' : LAYER_TYPE_LABELS[layer.type]}>
            <CategoryOption label="Type" type="select" value={layer.type} onChange={handleTypeChange}>
              {LAYER_TYPES.map(type => (
                <option key={type} value={type}>
                  {LAYER_TYPE_LABELS[type]}
                </option>
              ))}
            </CategoryOption>
            {layer.type === 'url' && <ImageMode layer={layer} onChange={onChange} />}
            {layer.type === 'raw' && <RawMode layer={layer} onChange={onChange} />}
            {layer.type === 'linear-gradient' && <LinearGradientMode layer={layer} onChange={onChange} />}
            {layer.type === 'radial-gradient' && <RadialGradientMode layer={layer} onChange={onChange} />}
            {layer.type === 'conic-gradient' && <ConicGradientMode layer={layer} onChange={onChange} />}
            {gradient && (
              <Switch
                size="xs"
                label="Repeat the gradient"
                checked={layer.repeating}
                onChange={handleRepeatingChange}
              />
            )}
          </LayerGroup>
          {placed && (
            <LayerGroup title="Placement">
              <BackgroundSize layer={layer} onChange={onChange} />
              <BackgroundPosition layer={layer} onChange={onChange} />
              <BackgroundTile layer={layer} onChange={onChange} />
              <BackgroundAttachment layer={layer} onChange={onChange} />
              <CategorySection label="Clip">
                <CategoryOption type="select" value={layer.clip} onChange={handleClipChange}>
                  {CLIP_OPTIONS.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </CategoryOption>
              </CategorySection>
            </LayerGroup>
          )}
        </div>
      )}
    </div>
  );
};

export default memo(BackgroundLayer);
