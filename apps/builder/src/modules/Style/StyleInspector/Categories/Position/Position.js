// Packages
import React, { memo, useCallback, use, useMemo } from 'react';
import noop from 'lodash/noop';
import Input from '@plitzi/plitzi-ui-components/Input';

// Monorepo
import { POSITION, TOP, BOTTOM, ZINDEX, FLOAT, CLEAR, LEFT, RIGHT } from '@plitzi/sdk-style/StyleConstants';

// Alias
import Icons from '@pcomponents/Icons';

// Relatives
import InspectorLabel from '../../InspectorLabel';
import PositionAdvancedButtons from './PositionAdvancedButtons';
import PositionClear from './PositionClear';
import PositionFloat from './PositionFloat';
import PositionAdvanced from './PositionAdvanced';
import StyleInspectorContext from '../../StyleInspectorContext';
import CategoryContainer from '../../../components/CategoryContainer';
import GroupButtons from '../../../components/GroupButtons';
import useInspectorValues from '../../hooks/useInspectorValues';

const STATIC = 'static';
const RELATIVE = 'relative';
const ABSOLUTE = 'absolute';
const FIXED = 'fixed';
const STICKY = 'sticky';

const dotKeys = [POSITION, TOP, BOTTOM, ZINDEX, FLOAT, CLEAR, LEFT, RIGHT];
const keyValue = [POSITION, TOP, BOTTOM, LEFT, RIGHT];

/**
 * @param {{
 *   isCollapsed?: boolean;
 *   onCollapse?: (type: string, isCollapsed: boolean) => void;
 * }} props
 * @returns {React.ReactElement}
 */
const Position = props => {
  const { isCollapsed = true, onCollapse = noop } = props;
  const { setValue } = use(StyleInspectorContext);
  const {
    [POSITION]: position,
    [TOP]: top,
    [BOTTOM]: bottom,
    [LEFT]: left,
    [RIGHT]: right,
    [FLOAT]: float,
    [CLEAR]: clear,
    [ZINDEX]: zIndex
  } = useInspectorValues({ keys: dotKeys, asValue: true });
  const advancedbuttons = useMemo(() => ({ top, bottom, left, right }), [top, bottom, left, right]);

  const handleChangeInput = type => e => {
    setValue(type, e.target.value);
  };

  const handleCollapse = useCallback(isCollapsed => onCollapse('position', isCollapsed), [onCollapse]);

  const handleChange = useCallback(
    itemValue => {
      const { type, value } = itemValue;
      if (type === 'position-path') {
        setValue(Object.keys(value), value);
      } else {
        setValue(type, value);
      }
    },
    [setValue]
  );

  const items = useMemo(
    () => [
      {
        value: { value: STATIC, type: POSITION },
        children: <Icons width={16} height={16} type="XMark" />,
        description: 'Static',
        active: position === STATIC
      },
      {
        value: { value: RELATIVE, type: POSITION },
        children: <Icons width={16} height={16} type="PositionRelative" />,
        description: 'Relative',
        active: position === RELATIVE
      },
      {
        value: { value: ABSOLUTE, type: POSITION },
        children: <Icons width={16} height={16} type="PositionAbsolute" />,
        description: 'Absolute',
        active: position === ABSOLUTE
      },
      {
        value: { value: FIXED, type: POSITION },
        children: <Icons width={16} height={16} type="PositionFixed" />,
        description: 'Fixed',
        active: position === FIXED
      },
      {
        value: { value: STICKY, type: POSITION },
        children: <Icons width={16} height={16} type="ListNumbers" />,
        description: 'Sticky',
        active: position === STICKY
      }
    ],
    [position]
  );

  return (
    <CategoryContainer title="Position" dotKeys={dotKeys} isCollapsed={isCollapsed} onCollapse={handleCollapse}>
      <div className="flex flex-col p-2 gap-2">
        <GroupButtons
          className="w-full"
          classNameContainer="w-[180px]"
          items={items}
          label="Position"
          keyValue={keyValue}
          onChange={handleChange}
        />
        {(position === FIXED || position === ABSOLUTE) && (
          <PositionAdvancedButtons value={advancedbuttons} onChange={handleChange} />
        )}
        <PositionAdvanced value={advancedbuttons} onChange={handleChange} />
        <PositionFloat value={float} onChange={handleChange} />
        <PositionClear value={clear} onChange={handleChange} />
        <div className="w-full flex items-center justify-between">
          <InspectorLabel keyValue={ZINDEX}>z-index</InspectorLabel>
          <Input
            type="number"
            className="!w-[180px]"
            size="sm"
            inputClassName="rounded-md"
            value={zIndex}
            onChange={handleChangeInput(ZINDEX)}
          />
        </div>
      </div>
    </CategoryContainer>
  );
};

export default memo(Position);
