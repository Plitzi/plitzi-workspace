import AlignSelfBaselineRow from '@plitzi/plitzi-ui/icons/AlignSelfBaselineRow';
import AlignSelfCenterRow from '@plitzi/plitzi-ui/icons/AlignSelfCenterRow';
import AlignSelfEndRow from '@plitzi/plitzi-ui/icons/AlignSelfEndRow';
import AlignSelfStartRow from '@plitzi/plitzi-ui/icons/AlignSelfStartRow';
import AlignSelfStretchRow from '@plitzi/plitzi-ui/icons/AlignSelfStretchRow';
import XMark from '@plitzi/plitzi-ui/icons/XMark';
import classNames from 'classnames';
import { useCallback, useMemo } from 'react';

import CategoryOption from '../../components/CategoryOption';
import CategorySection from '../../components/CategorySection';

import type { StyleCategory, StyleValue } from '@plitzi/sdk-shared';

export type DisplayAlignSelfProps = {
  value?: StyleValue;
  isFlexVertical?: boolean;
  onChange?: (type: StyleCategory, value: StyleValue) => void;
};

const keyValues: StyleCategory[] = ['align-self'];

const DisplayAlignSelf = ({ value, isFlexVertical = false, onChange }: DisplayAlignSelfProps) => {
  const handleChange = useCallback(
    (itemValue: StyleValue | Record<StyleCategory, StyleValue> | boolean) =>
      onChange?.('align-self', itemValue as StyleValue),
    [onChange]
  );

  const items = useMemo(
    () => [
      {
        value: 'auto',
        icon: <XMark />,
        description: 'Align Auto',
        active: value === 'auto'
      },
      {
        value: 'flex-start',
        icon: <AlignSelfStartRow className={classNames({ '-rotate-90': isFlexVertical })} />,
        description: 'Align Start',
        active: value === 'flex-start'
      },
      {
        value: 'center',
        icon: <AlignSelfCenterRow className={classNames({ '-rotate-90': isFlexVertical })} />,
        description: 'Align Center',
        active: value === 'center'
      },
      {
        value: 'flex-end',
        icon: <AlignSelfEndRow className={classNames({ '-rotate-90': isFlexVertical })} />,
        description: 'Align End',
        active: value === 'flex-end'
      },
      {
        value: 'stretch',
        icon: <AlignSelfStretchRow className={classNames({ '-rotate-90': isFlexVertical })} />,
        description: 'Align Stretch',
        active: value === 'stretch'
      },
      {
        value: 'baseline',
        icon: <AlignSelfBaselineRow />,
        description: 'Align Baseline',
        active: value === 'baseline'
      }
    ],
    [isFlexVertical, value]
  );

  return (
    <CategorySection label="Align" keys={keyValues}>
      <CategoryOption onChange={handleChange} type="iconGroup" items={items} />
    </CategorySection>
  );
};

export default DisplayAlignSelf;
