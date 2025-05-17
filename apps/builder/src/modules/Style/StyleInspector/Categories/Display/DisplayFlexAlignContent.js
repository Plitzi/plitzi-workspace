// Packages
import React, { useCallback, useMemo } from 'react';
import noop from 'lodash/noop';

// Monorepo
import { ALIGN_CONTENT } from '@plitzi/sdk-shared/style/StyleConstants';

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
const DisplayFlexAlignContent = props => {
  const { value, isReverse = false, isRow = false, onChange = noop } = props;

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
        active: value === 'flex-start'
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
        active: value === 'center'
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
        active: value === 'flex-end'
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
        active: value === 'stretch'
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
        active: value === 'space-between'
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
        active: value === 'space-around'
      }
    ],
    [value, isReverse, isRow]
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

export default DisplayFlexAlignContent;
