// Packages
import React, { useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import noop from 'lodash/noop';

// Monorepo
import { ALIGN_CONTENT } from '@plitzi/sdk-style/StyleConstants';

// Alias
import Icons from '@pcomponents/Icons';

// Relatives
import GroupButtons from '../../../components/GroupButtons';

const DisplayFlexAlignContent = props => {
  const { partialValue, isReverse = false, isRow = false, onChange = noop } = props;

  const handleChange = useCallback(itemValue => onChange(itemValue.type, itemValue.value), [onChange]);

  const items = useMemo(
    () => [
      {
        value: { value: 'flex-start', type: ALIGN_CONTENT },
        children: (
          <>
            {isRow && !isReverse && <Icons width={16} height={16} type="AlignContentStartRow" />}
            {isRow && isReverse && <Icons width={16} height={16} type="AlignContentStartReverseRow" />}
            {!isRow && !isReverse && <Icons width={16} height={16} type="AlignContentStartColumn" />}
            {!isRow && isReverse && <Icons width={16} height={16} type="AlignContentStartReverseColumn" />}
          </>
        ),
        description: 'Align Rows: Start',
        active: partialValue === 'flex-start'
      },
      {
        value: { value: 'center', type: ALIGN_CONTENT },
        children: (
          <>
            {isRow && <Icons width={16} height={16} type="AlignContentCenterRow" />}
            {!isRow && <Icons width={16} height={16} type="AlignContentCenterColumn" />}
          </>
        ),
        description: 'Align Rows: Center',
        active: partialValue === 'center'
      },
      {
        value: { value: 'flex-end', type: ALIGN_CONTENT },
        children: (
          <>
            {isRow && !isReverse && <Icons width={16} height={16} type="AlignContentEndRow" />}
            {isRow && isReverse && <Icons width={16} height={16} type="AlignContentEndReverseRow" />}
            {!isRow && !isReverse && <Icons width={16} height={16} type="AlignContentEndColumn" />}
            {!isRow && isReverse && <Icons width={16} height={16} type="AlignContentEndReverseColumn" />}
          </>
        ),
        description: 'Align Rows: End',
        active: partialValue === 'flex-end'
      },
      {
        value: { value: 'stretch', type: ALIGN_CONTENT },
        children: (
          <>
            {isRow && <Icons width={16} height={16} type="AlignContentStretchRow" />}
            {!isRow && <Icons width={16} height={16} type="AlignContentStretchColumn" />}
          </>
        ),
        description: 'Align Rows: Stretch',
        active: partialValue === 'stretch'
      },
      {
        value: { value: 'space-between', type: ALIGN_CONTENT },
        children: (
          <>
            {isRow && <Icons width={16} height={16} type="AlignContentSpaceBetweenRow" />}
            {!isRow && <Icons width={16} height={16} type="AlignContentSpaceBetweenColumn" />}
          </>
        ),
        description: 'Align Rows: Space Between',
        active: partialValue === 'space-between'
      },
      {
        value: { value: 'space-around', type: ALIGN_CONTENT },
        children: (
          <>
            {isRow && <Icons width={16} height={16} type="AlignContentSpaceAroundRow" />}
            {!isRow && <Icons width={16} height={16} type="AlignContentSpaceAroundColumn" />}
          </>
        ),
        description: 'Align Rows: Space Around',
        active: partialValue === 'space-around'
      }
    ],
    [partialValue, isReverse, isRow]
  );

  return (
    <GroupButtons
      classNameContainer="w-[180px]"
      items={items}
      label="Align"
      keyValue={ALIGN_CONTENT}
      onChange={handleChange}
    />
  );
};

DisplayFlexAlignContent.propTypes = {
  partialValue: PropTypes.string,
  isReverse: PropTypes.bool,
  isRow: PropTypes.bool,
  onChange: PropTypes.func
};

export default DisplayFlexAlignContent;
