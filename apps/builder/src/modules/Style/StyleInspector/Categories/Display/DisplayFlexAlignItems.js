// Packages
import React, { useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import noop from 'lodash/noop';

// Alias
import Icons from '@pcomponents/Icons';
import { ALIGN_ITEMS } from '@pmodules/Style/StyleConstants';

// Relatives
import GroupButtons from '../../../components/GroupButtons';

const DisplayFlexAlignItems = props => {
  const { partialValue, isReverse = false, isRow = false, onChange = noop } = props;

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
        active: partialValue === 'flex-start'
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
        active: partialValue === 'center'
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
        active: partialValue === 'flex-end'
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
        active: partialValue === 'stretch'
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
        active: partialValue === 'space-between'
      }
    ],
    [partialValue, isReverse, isRow]
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

DisplayFlexAlignItems.propTypes = {
  partialValue: PropTypes.string,
  isReverse: PropTypes.bool,
  isRow: PropTypes.bool,
  onChange: PropTypes.func
};

export default DisplayFlexAlignItems;
