// Packages
import React, { useCallback, useMemo } from 'react';
import noop from 'lodash/noop';

// Monorepo
import { ALIGN_SELF } from '@plitzi/sdk-style/StyleConstants';

// Alias
import Icons from '@pcomponents/Icons';

// Relatives
import GroupButtons from '../../../components/GroupButtons';

/**
 * @param {{
 *   value: string;
 *   onChange?: (type: string, value: string) => void;
 * }} props
 * @returns {React.ReactElement}
 */
const DisplayAlignSelf = props => {
  const { value, onChange = noop } = props;

  const handleChange = useCallback(itemValue => onChange(itemValue.type, itemValue.value), [onChange]);

  const items = useMemo(
    () => [
      {
        value: { value: 'auto', type: ALIGN_SELF },
        children: <Icons width={16} height={16} type="XMark" />,
        description: 'Align Auto',
        active: value === 'auto'
      },
      {
        value: { value: 'flex-start', type: ALIGN_SELF },
        children: <Icons width={16} height={16} type="AlignSelfStartRow" />,
        description: 'Align Start',
        active: value === 'flex-start'
      },
      {
        value: { value: 'center', type: ALIGN_SELF },
        children: <Icons width={16} height={16} type="AlignSelfCenterRow" />,
        description: 'Align Center',
        active: value === 'center'
      },
      {
        value: { value: 'flex-end', type: ALIGN_SELF },
        children: <Icons width={16} height={16} type="AlignSelfEndRow" />,
        description: 'Align End',
        active: value === 'flex-end'
      },
      {
        value: { value: 'stretch', type: ALIGN_SELF },
        children: <Icons width={16} height={16} type="AlignSelfStretchRow" />,
        description: 'Align Stretch',
        active: value === 'stretch'
      },
      {
        value: { value: 'baseline', type: ALIGN_SELF },
        children: <Icons width={16} height={16} type="AlignSelfBaselineRow" />,
        description: 'Align Baseline',
        active: value === 'baseline'
      }
    ],
    [value]
  );

  return (
    <GroupButtons
      classNameContainer="w-[180px]"
      items={items}
      label="Align"
      keyValue={ALIGN_SELF}
      onChange={handleChange}
    />
  );
};

export default DisplayAlignSelf;
