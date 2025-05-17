// Packages
import React, { memo, useCallback, use, useMemo } from 'react';
import noop from 'lodash/noop';
import isEqual from 'lodash/isEqual';

// Monorepo
import { ALIGN_SELF, ORDER, FLEX_GROW, FLEX_SHRINK, FLEX_BASIS } from '@plitzi/sdk-shared/style/StyleConstants';

// Alias
import Icons from '@pcomponents/Icons';

// Relatives
import DisplayAlignSelf from './DisplayAlignSelf';
import DisplayOrder from './DisplayOrder';
import StyleInspectorContext from '../../StyleInspectorContext';
import CategoryContainer from '../../../components/CategoryContainer';
import GroupButtons from '../../../components/GroupButtons';
import useInspectorValues from '../../hooks/useInspectorValues';

const dotKeys = [ALIGN_SELF, ORDER, FLEX_GROW, FLEX_SHRINK, FLEX_BASIS];

/**
 * @param {{
 *   isCollapsed?: boolean;
 *   isFlexVertical: boolean;
 *   onCollapse?: (type: string, isCollapsed: boolean) => void;
 * }} props
 * @returns {React.ReactElement}
 */
const DisplayFlexChild = props => {
  const { isCollapsed = true, isFlexVertical = false, onCollapse = noop } = props;
  const { setValue } = use(StyleInspectorContext);
  const {
    [FLEX_GROW]: flexGrow,
    [FLEX_SHRINK]: flexShrink,
    [FLEX_BASIS]: flexBasis,
    [ALIGN_SELF]: alignSelf,
    [ORDER]: order
  } = useInspectorValues({ keys: dotKeys, asValue: true });

  const handleChangeValue = useCallback((type, partialValue) => setValue(type, partialValue), [setValue]);

  const handleCollapse = useCallback(isCollapsed => onCollapse('displayFlexChild', isCollapsed), [onCollapse]);

  let customSizing = false;
  if (
    !(flexGrow === '0' && flexShrink === '1' && isEqual(flexBasis, 'auto')) &&
    !(flexGrow === '1' && flexShrink === '1' && isEqual(flexBasis, '0%')) &&
    !(flexGrow === '0' && flexShrink === '0' && isEqual(flexBasis, 'auto'))
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
        active: !customSizing && flexGrow === '0' && flexShrink === '1' && isEqual(flexBasis, 'auto')
      },
      {
        value: {
          value: { [FLEX_GROW]: '1', [FLEX_SHRINK]: '1', [FLEX_BASIS]: '0%' },
          type: [FLEX_GROW, FLEX_SHRINK, FLEX_BASIS]
        },
        children: <Icons width={16} height={16} type="FlexGrowRow" />,
        description: 'Grow if possible',
        active: !customSizing && flexGrow === '1' && flexShrink === '1' && isEqual(flexBasis, '0%')
      },
      {
        value: {
          value: { [FLEX_GROW]: '0', [FLEX_SHRINK]: '0', [FLEX_BASIS]: 'auto' },
          type: [FLEX_GROW, FLEX_SHRINK, FLEX_BASIS]
        },
        children: <Icons width={16} height={16} type="FlexNoneRow" />,
        description: "Don't shrink or grow",
        active: !customSizing && flexGrow === '0' && flexShrink === '0' && isEqual(flexBasis, 'auto')
      }
    ],
    [customSizing, flexGrow, flexShrink, flexBasis]
  );

  const items = useMemo(
    () => [
      { type: 'input', value: flexGrow, extraValue: { type: FLEX_GROW }, label: 'Grow' },
      { type: 'input', value: flexShrink, extraValue: { type: FLEX_SHRINK }, label: 'Shrink' },
      { type: 'inputMetric', value: flexBasis, extraValue: { type: FLEX_BASIS }, label: 'Basis' }
    ],
    [flexGrow, flexShrink, flexBasis]
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
        <DisplayAlignSelf value={alignSelf} isFlexVertical={isFlexVertical} onChange={handleChangeValue} />
        <DisplayOrder value={order} onChange={handleChangeValue} />
      </div>
    </CategoryContainer>
  );
};

export default memo(DisplayFlexChild);
