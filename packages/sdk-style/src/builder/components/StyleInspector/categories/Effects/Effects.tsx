import { memo, useCallback } from 'react';

import { BLEND_MODES } from '../blendModes';
import BoxShadow from './BoxShadow';
import Filter from './Filters/Filter';
import Transform from './Transform';
import Transition from './Transition';
import { EFFECTS_KEYS } from '../../categoryKeys';
import CategoryAdvanced from '../../components/CategoryAdvanced';
import CategoryContainer from '../../components/CategoryContainer';
import CategoryOption from '../../components/CategoryOption';
import CategorySection from '../../components/CategorySection';
import useInspectorValues from '../../hooks/useInspectorValues';
import usePropertyChange from '../../hooks/usePropertyChange';

export type EffectsProps = {
  replaceTokens?: boolean;
  isCollapsed?: boolean;
  onCollapse?: (category: string, isCollapsed: boolean) => void;
};

const Effects = ({ replaceTokens = false, isCollapsed = true, onCollapse }: EffectsProps) => {
  const {
    opacity,
    visibility,
    cursor,
    transition,
    'box-shadow': boxShadow,
    filter,
    'backdrop-filter': backdropFilter,
    'mix-blend-mode': mixBlendMode,
    isolation,
    'clip-path': clipPath,
    transform,
    'transform-origin': transformOrigin,
    perspective,
    'will-change': willChange
  } = useInspectorValues({
    keys: EFFECTS_KEYS.dot,
    asValue: true,
    strictMode: true,
    defaultValues: {
      opacity: '1',
      visibility: 'visible',
      cursor: 'auto',
      transition: undefined,
      'box-shadow': undefined,
      filter: undefined,
      'backdrop-filter': undefined,
      'mix-blend-mode': 'normal',
      isolation: 'auto',
      'clip-path': undefined,
      transform: undefined,
      'transform-origin': undefined,
      perspective: undefined,
      'will-change': undefined
    },
    replaceTokens
  });

  const handleCollapse = useCallback((isCollapsed: boolean) => onCollapse?.('effects', isCollapsed), [onCollapse]);

  const handleChange = usePropertyChange();

  return (
    <CategoryContainer
      title={EFFECTS_KEYS.title}
      dotKeys={EFFECTS_KEYS.dot}
      advancedKeys={EFFECTS_KEYS.advanced}
      isCollapsed={isCollapsed}
      onCollapse={handleCollapse}
    >
      <div className="flex flex-col gap-2">
        <CategorySection label="">
          <CategoryOption
            keys={['opacity']}
            label="Opacity"
            value={opacity}
            onChange={handleChange('opacity')}
            type="metric"
          />
          <CategoryOption
            keys={['visibility']}
            label="Visibility"
            value={visibility}
            onChange={handleChange('visibility')}
            type="select"
          >
            <option value="visible">Visible</option>
            <option value="hidden">Hidden</option>
            <option value="collapse">Collapse</option>
          </CategoryOption>
        </CategorySection>
        <CategorySection label="Cursor" keys={['cursor']}>
          <CategoryOption value={cursor} onChange={handleChange('cursor')} type="select">
            <optgroup label="General">
              <option value="auto">Auto</option>
              <option value="default">Default</option>
              <option value="none">None</option>
            </optgroup>
            <optgroup label="Links & Status">
              <option value="pointer">Pointer</option>
              <option value="not-allowed">Not Allowed</option>
              <option value="wait">Wait</option>
              <option value="progress">Progress</option>
              <option value="help">Help</option>
              <option value="context-menu">Context Menu</option>
            </optgroup>
            <optgroup label="Selection">
              <option value="cell">Cell</option>
              <option value="crosshair">Crosshair</option>
              <option value="text">Text</option>
              <option value="vertical-text">Vertical Text</option>
            </optgroup>
            <optgroup label="Drag & Drop">
              <option value="grab">Grab</option>
              <option value="grabbing">Grabbing</option>
              <option value="alias">Alias</option>
              <option value="copy">Copy</option>
              <option value="move">Move</option>
            </optgroup>
            <optgroup label="Zoom">
              <option value="zoom-in">Zoom In</option>
              <option value="zoom-out">Zoom Out</option>
            </optgroup>
            <optgroup label="Resize">
              <option value="col-resize">Col Resize</option>
              <option value="row-resize">Row Resize</option>
              <option value="nesw-resize">NESW Resize</option>
              <option value="nwse-resize">NWSE Resize</option>
              <option value="ew-resize">EW Resize</option>
              <option value="ns-resize">NS Resize</option>
              <option value="n-resize">N Resize</option>
              <option value="w-resize">W Resize</option>
              <option value="s-resize">S Resize</option>
              <option value="e-resize">E Resize</option>
              <option value="nw-resize">NW Resize</option>
              <option value="ne-resize">NE Resize</option>
              <option value="sw-resize">SW Resize</option>
              <option value="se-resize">SE Resize</option>
            </optgroup>
          </CategoryOption>
        </CategorySection>
        <BoxShadow onChange={handleChange('box-shadow')} value={boxShadow} />
        <Transform onChange={handleChange('transform')} value={transform} />
        <CategoryAdvanced>
          <CategorySection label="">
            <CategoryOption
              keys={['transform-origin']}
              label="Origin"
              value={transformOrigin}
              onChange={handleChange('transform-origin')}
            />
            <CategoryOption
              keys={['perspective']}
              label="Perspective"
              value={perspective}
              onChange={handleChange('perspective')}
              type="metric"
            />
          </CategorySection>
        </CategoryAdvanced>
        <Transition onChange={handleChange('transition')} value={transition} />
        <Filter onChange={handleChange('filter')} value={filter} />
        <CategoryAdvanced>
          <Filter
            styleKey="backdrop-filter"
            label="Backdrop Filters"
            onChange={handleChange('backdrop-filter')}
            value={backdropFilter}
          />
          <CategorySection label="">
            <CategoryOption
              keys={['mix-blend-mode']}
              label="Blend"
              value={mixBlendMode}
              onChange={handleChange('mix-blend-mode')}
              type="select"
            >
              {BLEND_MODES.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </CategoryOption>
            <CategoryOption
              keys={['isolation']}
              label="Isolation"
              value={isolation}
              onChange={handleChange('isolation')}
              type="select"
            >
              <option value="auto">Auto</option>
              <option value="isolate">Isolate</option>
            </CategoryOption>
          </CategorySection>
          <CategorySection label="">
            <CategoryOption
              keys={['clip-path']}
              label="Clip Path"
              value={clipPath}
              onChange={handleChange('clip-path')}
            />
            <CategoryOption
              keys={['will-change']}
              label="Will Change"
              value={willChange}
              onChange={handleChange('will-change')}
            />
          </CategorySection>
        </CategoryAdvanced>
      </div>
    </CategoryContainer>
  );
};

export default memo(Effects);
