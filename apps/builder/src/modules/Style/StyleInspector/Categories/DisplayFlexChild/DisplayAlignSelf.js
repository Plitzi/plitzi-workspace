// Packages
import React, { useCallback, useMemo } from 'react';
import noop from 'lodash/noop';
import classNames from 'classnames';

// Monorepo
import { ALIGN_SELF } from '@plitzi/sdk-shared/style/styleConstants';

// Alias
import Icons from '@pcomponents/Icons';

// Relatives
import GroupButtons from '../../../components/GroupButtons';

/**
 * @param {{
 *   value: string;
 *   isFlexVertical?: boolean;
 *   onChange?: (type: string, value: string) => void;
 * }} props
 * @returns {React.ReactElement}
 */
const DisplayAlignSelf = props => {
  const { value, isFlexVertical = false, onChange = noop } = props;

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
        children: (
          <Icons
            width={16}
            height={16}
            type="AlignSelfStartRow"
            className={classNames({ '-rotate-90': isFlexVertical })}
          />
        ),
        description: 'Align Start',
        active: value === 'flex-start'
      },
      {
        value: { value: 'center', type: ALIGN_SELF },
        children: (
          <Icons
            width={16}
            height={16}
            type="AlignSelfCenterRow"
            className={classNames({ '-rotate-90': isFlexVertical })}
          />
        ),
        description: 'Align Center',
        active: value === 'center'
      },
      {
        value: { value: 'flex-end', type: ALIGN_SELF },
        children: (
          <Icons
            width={16}
            height={16}
            type="AlignSelfEndRow"
            className={classNames({ '-rotate-90': isFlexVertical })}
          />
        ),
        description: 'Align End',
        active: value === 'flex-end'
      },
      {
        value: { value: 'stretch', type: ALIGN_SELF },
        children: (
          <Icons
            width={16}
            height={16}
            type="AlignSelfStretchRow"
            className={classNames({ '-rotate-90': isFlexVertical })}
          />
        ),
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
