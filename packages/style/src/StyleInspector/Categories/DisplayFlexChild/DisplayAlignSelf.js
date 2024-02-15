// Packages
import React, { useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import noop from 'lodash/noop';

// Alias
import Icons from '@pcomponents/Icons';
import { ALIGN_SELF } from '@pmodules/Style/StyleConstants';

// Relatives
import GroupButtons from '../../../components/GroupButtons';

const DisplayAlignSelf = props => {
  const { partialValue, onChange = noop } = props;

  const handleChange = useCallback(itemValue => onChange(itemValue.type, itemValue.value), [onChange]);

  const items = useMemo(
    () => [
      {
        value: { value: 'auto', type: ALIGN_SELF },
        children: <Icons width={16} height={16} type="XMark" />,
        description: 'Align Auto',
        active: partialValue === 'auto'
      },
      {
        value: { value: 'flex-start', type: ALIGN_SELF },
        children: <Icons width={16} height={16} type="AlignSelfStartRow" />,
        description: 'Align Start',
        active: partialValue === 'flex-start'
      },
      {
        value: { value: 'center', type: ALIGN_SELF },
        children: <Icons width={16} height={16} type="AlignSelfCenterRow" />,
        description: 'Align Center',
        active: partialValue === 'center'
      },
      {
        value: { value: 'flex-end', type: ALIGN_SELF },
        children: <Icons width={16} height={16} type="AlignSelfEndRow" />,
        description: 'Align End',
        active: partialValue === 'flex-end'
      },
      {
        value: { value: 'stretch', type: ALIGN_SELF },
        children: <Icons width={16} height={16} type="AlignSelfStretchRow" />,
        description: 'Align Stretch',
        active: partialValue === 'stretch'
      },
      {
        value: { value: 'baseline', type: ALIGN_SELF },
        children: <Icons width={16} height={16} type="AlignSelfBaselineRow" />,
        description: 'Align Baseline',
        active: partialValue === 'baseline'
      }
    ],
    [partialValue]
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

DisplayAlignSelf.propTypes = {
  partialValue: PropTypes.string,
  onChange: PropTypes.func
};

export default DisplayAlignSelf;
