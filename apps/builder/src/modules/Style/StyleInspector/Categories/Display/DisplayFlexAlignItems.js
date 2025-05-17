// Packages
import React, { useCallback, useMemo } from 'react';
import noop from 'lodash/noop';

// Monorepo
import { ALIGN_ITEMS } from '@plitzi/sdk-shared/style/StyleConstants';

// Alias
import Icons from '@pcomponents/Icons';

// Relatives
import GroupButtons from '../../../components/GroupButtons';

/**
 * @param {{
 *   value: string;
 *   isReverse?: boolean;
 *   isRow?: boolean;
 *   onChange?: (type: string, value: string) => void;
 * }} props
 * @returns {React.ReactElement}
 */
const DisplayFlexAlignItems = props => {
  const { value, isReverse = false, isRow = false, onChange = noop } = props;

  const handleChange = useCallback(itemValue => onChange(itemValue.type, itemValue.value), [onChange]);

  const items = useMemo(
    () => [
      {
        value: { value: 'flex-start', type: ALIGN_ITEMS },
        children: (
          <>
            {isRow && !isReverse && <Icons width={16} height={16} type="AlignItemsStartRow" />}
            {isRow && isReverse && <Icons width={16} height={16} type="AlignItemsStartRowReverse" />}
            {!isRow && !isReverse && <Icons width={16} height={16} type="AlignItemsStartColumn" />}
            {!isRow && isReverse && <Icons width={16} height={16} type="AlignItemsStartColumnReverse" />}
          </>
        ),
        description: 'Align Start',
        active: value === 'flex-start'
      },
      {
        value: { value: 'center', type: ALIGN_ITEMS },
        children: (
          <>
            {isRow && !isReverse && <Icons width={16} height={16} type="AlignItemsCenterRow" />}
            {isRow && isReverse && <Icons width={16} height={16} type="AlignItemsCenterRowReverse" />}
            {!isRow && !isReverse && <Icons width={16} height={16} type="AlignItemsCenterColumn" />}
            {!isRow && isReverse && <Icons width={16} height={16} type="AlignItemsCenterColumnReverse" />}
          </>
        ),
        description: 'Align Center',
        active: value === 'center'
      },
      {
        value: { value: 'flex-end', type: ALIGN_ITEMS },
        children: (
          <>
            {isRow && !isReverse && <Icons width={16} height={16} type="AlignItemsEndRow" />}
            {isRow && isReverse && <Icons width={16} height={16} type="AlignItemsEndRowReverse" />}
            {!isRow && !isReverse && <Icons width={16} height={16} type="AlignItemsEndColumn" />}
            {!isRow && isReverse && <Icons width={16} height={16} type="AlignItemsEndColumnReverse" />}
          </>
        ),
        description: 'Align End',
        active: value === 'flex-end'
      },
      {
        value: { value: 'stretch', type: ALIGN_ITEMS },
        children: (
          <>
            {isRow && <Icons width={16} height={16} type="AlignItemsStretchRow" />}
            {!isRow && <Icons width={16} height={16} type="AlignItemsStretchColumn" />}
          </>
        ),
        description: 'Align Stretch',
        active: value === 'stretch'
      },
      {
        value: { value: 'baseline', type: ALIGN_ITEMS },
        children: (
          <>
            {isRow && !isReverse && <Icons width={16} height={16} type="AlignItemsBaselineRow" />}
            {isRow && isReverse && <Icons width={16} height={16} type="AlignItemsBaselineRowReverse" />}
            {!isRow && !isReverse && <Icons width={16} height={16} type="AlignItemsBaselineColumn" />}
            {!isRow && isReverse && <Icons width={16} height={16} type="AlignItemsBaselineColumnReverse" />}
          </>
        ),
        description: 'Align Baseline',
        active: value === 'space-between'
      }
    ],
    [value, isReverse, isRow]
  );

  return (
    <GroupButtons
      classNameContainer="w-[180px]"
      items={items}
      label="Align"
      keyValue={ALIGN_ITEMS}
      onChange={handleChange}
    />
  );
};

export default DisplayFlexAlignItems;
