// Packages
import React, { memo, useCallback, useContext, useMemo } from 'react';
import PropTypes from 'prop-types';
import noop from 'lodash/noop';
import isEqual from 'lodash/isEqual';

// Monorepo
import { ALIGN_SELF, ORDER, FLEX_GROW, FLEX_SHRINK, FLEX_BASIS } from '@plitzi/sdk-style/StyleConstants';

// Alias
import Icons from '@pcomponents/Icons';

// Relatives
import DisplayAlignSelf from './DisplayAlignSelf';
import DisplayOrder from './DisplayOrder';
import StyleInspectorContext from '../../StyleInspectorContext';
import CategoryContainer from '../../../components/CategoryContainer';
import GroupButtons from '../../../components/GroupButtons';

const dotKeys = [ALIGN_SELF, ORDER, FLEX_GROW, FLEX_SHRINK, FLEX_BASIS];

const DisplayFlexChild = props => {
  const { isCollapsed = true, onCollapse = noop } = props;
  const { getValue, setValue } = useContext(StyleInspectorContext);

  const handleChangeValue = (type, partialValue) => setValue(type, partialValue);

  const handleCollapse = useCallback(isCollapsed => onCollapse('displayFlexChild', isCollapsed), [onCollapse]);

  const grow = getValue(FLEX_GROW);
  const shrink = getValue(FLEX_SHRINK);
  const basis = getValue(FLEX_BASIS);
  let customSizing = false;
  if (
    !(grow === '0' && shrink === '1' && isEqual(basis, 'auto')) &&
    !(grow === '1' && shrink === '1' && isEqual(basis, '0%')) &&
    !(grow === '0' && shrink === '0' && isEqual(basis, 'auto'))
  ) {
    customSizing = true;
  }

  const keyValueMemo = useMemo(() => [FLEX_GROW, FLEX_SHRINK, FLEX_BASIS], []);

  const handleChange = useCallback(itemValue => setValue(itemValue.type, itemValue.value), [setValue]);

  const sizingItems = useMemo(
    () => [
      {
        value: {
          value: { [FLEX_GROW]: '0', [FLEX_SHRINK]: '1', [FLEX_BASIS]: 'auto' },
          type: [FLEX_GROW, FLEX_SHRINK, FLEX_BASIS]
        },
        children: <Icons width={16} height={16} type="FlexShrinkRow" />,
        description: 'Shrink if needed',
        active: !customSizing && grow === '0' && shrink === '1' && isEqual(basis, 'auto')
      },
      {
        value: {
          value: { [FLEX_GROW]: '1', [FLEX_SHRINK]: '1', [FLEX_BASIS]: '0%' },
          type: [FLEX_GROW, FLEX_SHRINK, FLEX_BASIS]
        },
        children: <Icons width={16} height={16} type="FlexGrowRow" />,
        description: 'Grow if possible',
        active: !customSizing && grow === '1' && shrink === '1' && isEqual(basis, '0%')
      },
      {
        value: {
          value: { [FLEX_GROW]: '0', [FLEX_SHRINK]: '0', [FLEX_BASIS]: 'auto' },
          type: [FLEX_GROW, FLEX_SHRINK, FLEX_BASIS]
        },
        children: <Icons width={16} height={16} type="FlexNoneRow" />,
        description: "Don't shrink or grow",
        active: !customSizing && grow === '0' && shrink === '0' && isEqual(basis, 'auto')
      }
    ],
    [customSizing, grow, shrink, basis]
  );

  const items = useMemo(
    () => [
      { type: 'input', value: grow, extraValue: { type: FLEX_GROW }, label: 'Grow' },
      { type: 'input', value: shrink, extraValue: { type: FLEX_SHRINK }, label: 'Shrink' },
      { type: 'inputMetric', value: basis, extraValue: { type: FLEX_BASIS }, label: 'Basis' }
    ],
    [grow, shrink, basis]
  );

  return (
    <CategoryContainer title="Flex Child" dotKeys={dotKeys} isCollapsed={isCollapsed} onCollapse={handleCollapse}>
      <div className="p-2 flex flex-col gap-2">
        <GroupButtons
          classNameContainer="w-[180px]"
          items={sizingItems}
          label="Sizing"
          keyValue={keyValueMemo}
          onChange={handleChange}
        />
        <GroupButtons
          className="w-full !justify-end"
          classNameContainer="w-[180px]"
          items={items}
          label=""
          keyValue={keyValueMemo}
          onChange={handleChange}
        />
        <DisplayAlignSelf partialValue={getValue(ALIGN_SELF)} onChange={handleChangeValue} />
        <DisplayOrder partialValue={getValue(ORDER)} onChange={handleChangeValue} />
      </div>
    </CategoryContainer>
  );
};

DisplayFlexChild.propTypes = {
  isCollapsed: PropTypes.bool,
  onCollapse: PropTypes.func
};

export default memo(DisplayFlexChild);
