// Packages
import React, { memo, useCallback, useContext, useMemo } from 'react';
import noop from 'lodash/noop';

// Monorepo
import { OPACITY, CURSOR, TRANSITION, BOX_SHADOW, FILTER, TRANSFORM } from '@plitzi/sdk-style/StyleConstants';

// Relatives
import Transition from './Transition';
import BoxShadow from './BoxShadow';
import Filter from './Filters/Filter';
import Transform from './Transform/Transform';
import StyleInspectorContext from '../../StyleInspectorContext';
import CategoryContainer from '../../../components/CategoryContainer';
import GroupButtons from '../../../components/GroupButtons';

const dotKeys = [OPACITY, CURSOR, TRANSITION, BOX_SHADOW, FILTER, TRANSFORM];

/**
 * @param {{
 *   isCollapsed?: boolean;
 *   onCollapse?: (category: string, collapsed: boolean) => void;
 * }} props
 * @returns {React.ReactElement}
 */
const Effects = props => {
  const { isCollapsed = true, onCollapse = noop } = props;
  const { getValue, setValue } = useContext(StyleInspectorContext);
  const cursor = getValue(CURSOR);
  const opacity = getValue(OPACITY);

  const handleCollapse = useCallback(isCollapsed => onCollapse('effects', isCollapsed), [onCollapse]);

  const handleChange = useCallback(itemValue => setValue(itemValue.type, itemValue.value), [setValue]);

  const itemsOpacity = useMemo(() => [{ type: 'input', value: opacity, extraValue: { type: OPACITY } }], [opacity]);

  const itemsCursor = useMemo(
    () => [
      {
        type: 'select',
        value: cursor,
        extraValue: { type: CURSOR },
        children: (
          <>
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
          </>
        )
      }
    ],
    [cursor]
  );

  return (
    <CategoryContainer title="Effects" dotKeys={dotKeys} isCollapsed={isCollapsed} onCollapse={handleCollapse}>
      <div className="flex flex-col p-2 gap-2">
        <GroupButtons
          classNameContainer="w-[180px]"
          keyValue={OPACITY}
          items={itemsOpacity}
          label="Opacity"
          onChange={handleChange}
        />
        <GroupButtons
          classNameContainer="w-[180px]"
          keyValue={CURSOR}
          items={itemsCursor}
          label="Cursor"
          onChange={handleChange}
        />
        <BoxShadow onChange={handleChange} partialValue={getValue(BOX_SHADOW, undefined, true)} />
        <Transform onChange={handleChange} partialValue={getValue(TRANSFORM, undefined, true)} />
        <Transition onChange={handleChange} partialValue={getValue(TRANSITION, undefined, true)} />
        <Filter onChange={handleChange} partialValue={getValue(FILTER, undefined, true)} />
      </div>
    </CategoryContainer>
  );
};

export default memo(Effects);
