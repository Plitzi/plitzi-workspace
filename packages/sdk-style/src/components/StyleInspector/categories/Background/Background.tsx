import useDidUpdateEffect from '@plitzi/plitzi-ui/hooks/useDidUpdateEffect';
import { memo, useCallback, use, useState, useRef } from 'react';

import BackgroundLayer from './components/BackgroundLayer';
import {
  DEFAULT_LAYER_PROPS,
  DEFAULT_STOPS,
  newLayerId,
  newStopId,
  serializeLayersToCSS
} from './helpers/backgroundParser';
import CategoryContainer from '../../components/CategoryContainer';
import CategoryOption from '../../components/CategoryOption';
import CategorySection from '../../components/CategorySection';
import useInspectorValues from '../../hooks/useInspectorValues';
import StyleInspectorContext from '../../StyleInspectorContext';
import parseToBgLayers from './helpers/parseToBgLayers';
import InspectorLabel from '../../components/InspectorLabel';

import type { BackgroundLayer as TBackgroundLayer } from './helpers/backgroundParser';
import type { StyleCategory, StyleValue } from '@plitzi/sdk-shared';

const DOT_KEYS = [
  'background-color',
  'background-image',
  'background-attachment',
  'background-position',
  'background-repeat',
  'background-clip',
  'background-size',
  'mask-image'
] as StyleCategory[];

const BG_LAYER_KEYS: StyleCategory[] = [
  'background-image',
  'background-size',
  'background-position',
  'background-repeat',
  'background-attachment',
  'background-clip'
];

export type BackgroundProps = {
  replaceTokens?: boolean;
  isCollapsed?: boolean;
  onCollapse?: (category: string, isCollapsed: boolean) => void;
};

const cssKeyFromRecord = (record: Partial<Record<StyleCategory, StyleValue>>): string =>
  BG_LAYER_KEYS.map(k => String(record[k])).join('||');

const Background = ({ replaceTokens = false, isCollapsed = true, onCollapse }: BackgroundProps) => {
  const { setValue } = use(StyleInspectorContext);

  const layerValues = useInspectorValues({ keys: BG_LAYER_KEYS, asValue: true, strictMode: true, replaceTokens });
  const { 'background-color': bgColor, 'mask-image': maskImage } = useInspectorValues({
    keys: ['background-color', 'mask-image'],
    asValue: true,
    replaceTokens
  });

  const cssKey = cssKeyFromRecord(layerValues);
  const layerValuesRef = useRef(layerValues);
  layerValuesRef.current = layerValues;

  const internalCssKeyRef = useRef<string | null>(null);
  const [layers, setLayers] = useState<TBackgroundLayer[]>(() => parseToBgLayers(layerValues));

  useDidUpdateEffect(() => {
    if (cssKey === internalCssKeyRef.current) {
      return;
    }

    setLayers(parseToBgLayers(layerValuesRef.current));
  }, [cssKey]);

  const [expandedId, setExpandedId] = useState<string | null>(null);

  const handleToggleExpand = useCallback((id: string) => setExpandedId(prev => (prev === id ? null : id)), []);

  const applyLayers = useCallback(
    (newLayers: TBackgroundLayer[]) => {
      const css = serializeLayersToCSS(newLayers);
      internalCssKeyRef.current = cssKeyFromRecord(css);
      setLayers(newLayers);
      setValue(undefined, css);
    },
    [setValue]
  );

  const handleReorder = useCallback(
    (fromIndex: number, toIndex: number) => {
      if (fromIndex === toIndex) {
        return;
      }

      const reordered = [...layers];
      const [moved] = reordered.splice(fromIndex, 1);
      reordered.splice(toIndex, 0, moved);
      applyLayers(reordered);
    },
    [layers, applyLayers]
  );

  const handleLayerChange = useCallback(
    (index: number) => (updated: TBackgroundLayer) => {
      applyLayers(layers.map((l, i) => (i === index ? updated : l)));
    },
    [layers, applyLayers]
  );

  const handleAddLayer = useCallback(() => {
    const newId = newLayerId();
    const newLayer: TBackgroundLayer = {
      ...DEFAULT_LAYER_PROPS,
      id: newId,
      type: 'linear-gradient',
      stops: [
        { id: newStopId(), color: DEFAULT_STOPS[0].color, position: '0%' },
        { id: newStopId(), color: DEFAULT_STOPS[1].color, position: '100%' }
      ]
    };

    setExpandedId(newId);
    applyLayers([newLayer, ...layers]);
  }, [layers, applyLayers]);

  const handleRemoveLayer = useCallback(
    (index: number) => () => {
      applyLayers(layers.filter((_, i) => i !== index));
    },
    [layers, applyLayers]
  );

  const handleBgColorChange = useCallback(
    (value: StyleValue | Record<StyleCategory, StyleValue> | boolean) => {
      setValue('background-color', value as StyleValue);
    },
    [setValue]
  );

  const handleMaskImageChange = useCallback(
    (value: StyleValue | Record<StyleCategory, StyleValue> | boolean) => {
      setValue('mask-image', value as StyleValue);
    },
    [setValue]
  );

  const handleCollapse = useCallback((collapsed: boolean) => onCollapse?.('background', collapsed), [onCollapse]);

  return (
    <CategoryContainer title="Background" dotKeys={DOT_KEYS} isCollapsed={isCollapsed} onCollapse={handleCollapse}>
      <div className="flex flex-col gap-2">
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <InspectorLabel keyValue={BG_LAYER_KEYS}>Layers</InspectorLabel>
            <button
              type="button"
              className="flex cursor-pointer items-center gap-1 rounded px-1.5 py-0.5 text-xs text-blue-500 hover:bg-blue-50 hover:text-blue-700 dark:hover:bg-blue-900/30"
              onClick={handleAddLayer}
              title="Add background layer"
            >
              <i className="fas fa-plus text-[10px]" />
              Add
            </button>
          </div>

          {!layers.length && (
            <div className="rounded border border-dashed border-gray-300 py-3 text-center text-xs text-gray-400 dark:border-zinc-600 dark:text-zinc-500">
              No layers — click Add to start
            </div>
          )}

          {layers.length > 0 && (
            <div className="flex flex-col gap-1">
              {layers.map((layer, index) => (
                <BackgroundLayer
                  key={layer.id}
                  index={index}
                  layer={layer}
                  expanded={expandedId === layer.id}
                  onExpand={handleToggleExpand}
                  onChange={handleLayerChange(index)}
                  onRemove={handleRemoveLayer(index)}
                  onReorder={handleReorder}
                />
              ))}
            </div>
          )}
        </div>

        <CategorySection label="Base Color" keys={['background-color']}>
          <CategoryOption type="color" value={bgColor} onChange={handleBgColorChange} />
        </CategorySection>

        <CategorySection label="Mask" keys={['mask-image']}>
          <CategoryOption value={maskImage} onChange={handleMaskImageChange} />
        </CategorySection>
      </div>
    </CategoryContainer>
  );
};

export default memo(Background);
