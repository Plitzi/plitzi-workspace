// Packages
import React, { useCallback, useMemo } from 'react';
import noop from 'lodash/noop';

// Monorepo
import { JUSTIFY_CONTENT } from '@plitzi/sdk-style/StyleConstants';

// Alias
import Icons from '@pcomponents/Icons';

// Relatives
import GroupButtons from '../../../components/GroupButtons';

/**
 * @param {{
 *   partialValue: string;
 *   isReverse?: boolean;
 *   isRow?: boolean;
 *   onChange?: (type: string, value: string) => void;
 * }} props
 * @returns {React.ReactElement}
 */
const DisplayFlexJustify = props => {
  const { partialValue, isReverse = false, isRow = false, onChange = noop } = props;

  const handleChange = useCallback(itemValue => onChange(itemValue.type, itemValue.value), [onChange]);

  const items = useMemo(
    () => [
      {
        value: { value: 'flex-start', type: JUSTIFY_CONTENT },
        children: (
          <>
            {isRow && !isReverse && <Icons width={16} height={16} type="JustifyContentStartRow" />}
            {isRow && isReverse && <Icons width={16} height={16} type="JustifyContentStartRowReverse" />}
            {!isRow && !isReverse && <Icons width={16} height={16} type="JustifyContentStartColumn" />}
            {!isRow && isReverse && <Icons width={16} height={16} type="JustifyContentStartColumnReverse" />}
          </>
        ),
        description: 'Justify Start',
        active: partialValue === 'flex-start'
      },
      {
        value: { value: 'center', type: JUSTIFY_CONTENT },
        children: (
          <>
            {isRow && <Icons width={16} height={16} type="JustifyContentCenterRow" />}
            {!isRow && <Icons width={16} height={16} type="JustifyContentCenterColumn" />}
          </>
        ),
        description: 'Justify Center',
        active: partialValue === 'center'
      },
      {
        value: { value: 'flex-end', type: JUSTIFY_CONTENT },
        children: (
          <>
            {isRow && !isReverse && <Icons width={16} height={16} type="JustifyContentEndRow" />}
            {isRow && isReverse && <Icons width={16} height={16} type="JustifyContentEndRowReverse" />}
            {!isRow && !isReverse && <Icons width={16} height={16} type="JustifyContentEndColumn" />}
            {!isRow && isReverse && <Icons width={16} height={16} type="JustifyContentEndColumnReverse" />}
          </>
        ),
        description: 'Justify End',
        active: partialValue === 'flex-end'
      },
      {
        value: { value: 'space-between', type: JUSTIFY_CONTENT },
        children: (
          <>
            {isRow && <Icons width={16} height={16} type="JustifyContentSpaceBetweenRow" />}
            {!isRow && <Icons width={16} height={16} type="JustifyContentSpaceBetweenColumn" />}
          </>
        ),
        description: 'Justify Space Between - distribute evenly from start to end',
        active: partialValue === 'space-between'
      },
      {
        value: { value: 'space-around', type: JUSTIFY_CONTENT },
        children: (
          <>
            {isRow && <Icons width={16} height={16} type="JustifyContentSpaceAroundRow" />}
            {!isRow && <Icons width={16} height={16} type="JustifyContentSpaceAroundColumn" />}
          </>
        ),
        description: 'Justify Space Around - distribute evenly, why space around all children',
        active: partialValue === 'space-around'
      }
    ],
    [partialValue, isReverse, isRow]
  );

  return (
    <GroupButtons
      classNameContainer="w-[180px]"
      items={items}
      label="Justify"
      keyValue={JUSTIFY_CONTENT}
      onChange={handleChange}
    />
  );
};

export default DisplayFlexJustify;
