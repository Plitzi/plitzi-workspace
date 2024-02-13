// Packages
import React, { memo, useCallback, useContext, useMemo } from 'react';
import PropTypes from 'prop-types';
import noop from 'lodash/noop';
import Input from '@plitzi/plitzi-ui-components/Input';

// Alias
import Icons from '@pcomponents/Icons';
import { POSITION, TOP, BOTTOM, ZINDEX, FLOAT, CLEAR, LEFT, RIGHT } from '@pmodules/Style/StyleConstants';

// Relatives
import InspectorLabel from '../../InspectorLabel';
import PositionAdvancedButtons from './PositionAdvancedButtons';
import PositionClear from './PositionClear';
import PositionFloat from './PositionFloat';
import PositionAdvanced from './PositionAdvanced';
import StyleInspectorContext from '../../StyleInspectorContext';
import withStyleInspector from '../../withStyleInspector';
import CategoryContainer from '../../../components/CategoryContainer';
import GroupButtons from '../../../components/GroupButtons';

const STATIC = 'static';
const RELATIVE = 'relative';
const ABSOLUTE = 'absolute';
const FIXED = 'fixed';
const STICKY = 'sticky';

const dotKeys = [POSITION, TOP, BOTTOM, ZINDEX, FLOAT, CLEAR, LEFT, RIGHT];

const Position = props => {
  const { isCollapsed = true, onCollapse = noop } = props;
  const { getValue, setValue } = useContext(StyleInspectorContext);

  const handleChangeInput = type => e => {
    setValue(type, e.target.value);
  };

  const handleCollapse = useCallback(isCollapsed => onCollapse('position', isCollapsed), [onCollapse]);

  const position = getValue(POSITION);
  const advancedbuttons = getValue([TOP, BOTTOM, LEFT, RIGHT]);

  const keyValueMemo = useMemo(() => [POSITION, TOP, BOTTOM, LEFT, RIGHT], []);

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
          keyValue={keyValueMemo}
          onChange={handleChange}
        />
        {(position === FIXED || position === ABSOLUTE) && (
          <PositionAdvancedButtons partialValue={advancedbuttons} onChange={handleChange} />
        )}
        <PositionAdvanced partialValue={advancedbuttons} onChange={handleChange} />
        <PositionFloat partialValue={getValue(FLOAT)} onChange={handleChange} />
        <PositionClear partialValue={getValue(CLEAR)} onChange={handleChange} />
        <div className="w-full flex items-center justify-between">
          <InspectorLabel keyValue={ZINDEX}>z-index</InspectorLabel>
          <Input
            type="number"
            className="!w-[180px]"
            size="sm"
            inputClassName="rounded-md"
            value={getValue(ZINDEX)}
            onChange={handleChangeInput(ZINDEX)}
          />
        </div>
      </div>
    </CategoryContainer>
  );
};

Position.propTypes = {
  isCollapsed: PropTypes.bool,
  onCollapse: PropTypes.func
};

export default memo(withStyleInspector(Position));
