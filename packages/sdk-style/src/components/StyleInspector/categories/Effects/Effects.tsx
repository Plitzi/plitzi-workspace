import { memo, use, useCallback } from 'react';

import BoxShadow from './BoxShadow';
import Filter from './Filters/Filter';
import Transform from './Transform';
import Transition from './Transition';
import CategoryContainer from '../../components/CategoryContainer';
import CategoryOption from '../../components/CategoryOption';
import CategorySection from '../../components/CategorySection';
import useInspectorValues from '../../hooks/useInspectorValues';
import StyleInspectorContext from '../../StyleInspectorContext';

import type { StyleCategory, StyleValue } from '@plitzi/sdk-shared';

const dotKeys = ['opacity', 'cursor', 'transition', 'box-shadow', 'filter', 'transform'] as StyleCategory[];

export type EffectsProps = {
  isCollapsed?: boolean;
  onCollapse?: (category: string, isCollapsed: boolean) => void;
};

const Effects = ({ isCollapsed = true, onCollapse }: EffectsProps) => {
  const { setValue } = use(StyleInspectorContext);
  const {
    opacity,
    cursor,
    transition,
    'box-shadow': boxShadow,
    filter,
    transform
  } = useInspectorValues({
    keys: dotKeys,
    asValue: true,
    strictMode: true,
    defaultValues: {
      opacity: '1',
      cursor: 'auto',
      transition: undefined,
      'box-shadow': undefined,
      filter: undefined,
      transform: undefined
    }
  });

  const handleCollapse = useCallback((isCollapsed: boolean) => onCollapse?.('effects', isCollapsed), [onCollapse]);

  const handleChange = useCallback(
    (type: StyleCategory) => (value: StyleValue | Record<StyleCategory, StyleValue> | boolean) =>
      setValue(type, value as StyleValue),
    [setValue]
  );

  return (
    <CategoryContainer title="Effects" dotKeys={dotKeys} isCollapsed={isCollapsed} onCollapse={handleCollapse}>
      <div className="flex flex-col gap-2">
        <CategorySection label="Size" keys={['opacity']}>
          <CategoryOption value={opacity} onChange={handleChange('cursor')} type="metric" />
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
        <Transition onChange={handleChange('transition')} value={transition} />
        <Filter onChange={handleChange('filter')} value={filter} />
      </div>
    </CategoryContainer>
  );
};

export default memo(Effects);
