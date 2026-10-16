import useDidUpdateEffect from '@plitzi/plitzi-ui/hooks/useDidUpdateEffect';
import { memo, useCallback, use, useState, useRef } from 'react';

import { BLEND_MODES } from '../blendModes';
import BackgroundLayer from './components/BackgroundLayer';
import {
  DEFAULT_LAYER_PROPS,
  DEFAULT_STOPS,
  newLayerId,
  newStopId,
  serializeLayersToCSS
} from './helpers/backgroundParser';
import { BACKGROUND_KEYS } from '../../categoryKeys';
import CategoryAdvanced from '../../components/CategoryAdvanced';
import CategoryContainer from '../../components/CategoryContainer';
import CategoryOption from '../../components/CategoryOption';
import CategorySection from '../../components/CategorySection';
import useInspectorValues from '../../hooks/useInspectorValues';
import StyleInspectorContext from '../../StyleInspectorContext';
import { BG_LAYER_KEYS, layerValuesKey } from './helpers/layerValues';
import parseToBgLayers from './helpers/parseToBgLayers';
import ValueList from '../../components/ValueList';

import type { BackgroundLayer as TBackgroundLayer } from './helpers/backgroundParser';
import type { StyleCategory, StyleValue } from '@plitzi/sdk-shared';

const BASE_COLOR_KEYS: StyleCategory[] = ['background-color'];

export type BackgroundProps = {
  replaceTokens?: boolean;
  isCollapsed?: boolean;
  onCollapse?: (category: string, isCollapsed: boolean) => void;
};

const Background = ({ replaceTokens = false, isCollapsed = true, onCollapse }: BackgroundProps) => {
  const { setValue } = use(StyleInspectorContext);

  // Never with the tokens resolved: every layer is written back on any edit, and a resolved token would be written in
  // place of the token itself. The previews resolve them for themselves.
  const layerValues = useInspectorValues({ keys: BG_LAYER_KEYS, asValue: true, strictMode: true });
  const {
    'background-color': bgColor,
    'background-blend-mode': bgBlendMode,
    'mask-image': maskImage
  } = useInspectorValues({
    keys: ['background-color', 'background-blend-mode', 'mask-image'],
    asValue: true,
    replaceTokens
  });

  const cssKey = layerValuesKey(layerValues);
  const layerValuesRef = useRef(layerValues);
  layerValuesRef.current = layerValues;

  const internalCssKeyRef = useRef<string | null>(null);
  const [layers, setLayers] = useState<TBackgroundLayer[]>(() => parseToBgLayers(layerValues));

  useDidUpdateEffect(() => {
    if (cssKey === internalCssKeyRef.current) {
      return;
    }

    setLayers(parseToBgLayers(layerValuesRef.current));
    internalCssKeyRef.current = cssKey;
  }, [cssKey]);

  const [expandedId, setExpandedId] = useState<string | null>(null);

  const handleToggleExpand = useCallback((id: string) => setExpandedId(prev => (prev === id ? null : id)), []);

  const applyLayers = useCallback(
    (newLayers: TBackgroundLayer[]) => {
      const css = serializeLayersToCSS(newLayers);
      internalCssKeyRef.current = layerValuesKey(css);
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
    applyLayers([...layers, newLayer]);
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

  const handleBgBlendModeChange = useCallback(
    (value: StyleValue | Record<StyleCategory, StyleValue> | boolean) => {
      setValue('background-blend-mode', value as StyleValue);
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
    <CategoryContainer
      title={BACKGROUND_KEYS.title}
      dotKeys={BACKGROUND_KEYS.dot}
      advancedKeys={BACKGROUND_KEYS.advanced}
      isCollapsed={isCollapsed}
      onCollapse={handleCollapse}
    >
      <div className="flex flex-col gap-2">
        <ValueList
          label="Layers"
          keys={BG_LAYER_KEYS}
          addLabel="Add a layer — the first one is drawn on top"
          onAdd={handleAddLayer}
        >
          {!layers.length && (
            <p className="m-0 rounded-md border border-dashed border-gray-300 px-3 py-2.5 text-center text-xs text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
              No layers. Add one for a gradient or an image.
            </p>
          )}
          {layers.length > 0 &&
            layers.map((layer, index) => (
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
        </ValueList>

        <CategorySection label="Color" keys={BASE_COLOR_KEYS}>
          <CategoryOption type="color" value={bgColor} onChange={handleBgColorChange} />
        </CategorySection>

        <CategoryAdvanced>
          <CategorySection label="">
            <CategoryOption
              keys={['background-blend-mode']}
              label="Blend"
              value={bgBlendMode}
              onChange={handleBgBlendModeChange}
              type="select"
            >
              {BLEND_MODES.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </CategoryOption>
            <CategoryOption keys={['mask-image']} label="Mask" value={maskImage} onChange={handleMaskImageChange} />
          </CategorySection>
        </CategoryAdvanced>
      </div>
    </CategoryContainer>
  );
};

export default memo(Background);
