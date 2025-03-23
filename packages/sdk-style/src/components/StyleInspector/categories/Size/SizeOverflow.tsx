import { SizeOverflowScroll } from '@plitzi/plitzi-ui/icons';
import { useMemo } from 'react';

import { OVERFLOW } from '@plitzi/sdk-shared/style';

import CategoryOption from '../../components/CategoryOption';
import CategorySection from '../../components/CategorySection';

import type { StyleCategory, StyleValue } from '@plitzi/sdk-shared';

export type SizeOverflowProps = {
  value?: StyleValue;
  onChange?: (type: StyleCategory) => (value: StyleValue | Record<StyleCategory, StyleValue> | boolean) => void;
};

const SizeOverflow = ({ value, onChange }: SizeOverflowProps) => {
  const items = useMemo(
    () => [
      {
        value: 'visible',
        icon: 'fa-solid fa-eye',
        description: 'Visible',
        active: value === 'visible'
      },
      {
        value: 'hidden',
        icon: 'fa-solid fa-eye-slash',
        description: 'Hidden',
        active: value === 'hidden'
      },
      {
        value: 'scroll',
        icon: <SizeOverflowScroll />,
        description: 'Scroll',
        active: value === 'scroll'
      },
      {
        value: 'auto',
        icon: <div className="text-xs select-none px-1">Auto</div>,
        description: '',
        active: value === 'auto',
        size: 'custom' as const
      }
    ],
    [value]
  );

  return (
    <CategorySection label="Size" keys={[OVERFLOW]}>
      <CategoryOption onChange={onChange?.(OVERFLOW)} type="iconGroup" items={items} />
    </CategorySection>
  );

  // return (
  //   <GroupButtons
  //     className="w-full"
  //     classNameContainer="w-[180px]"
  //     items={items}
  //     label="Overflow"
  //     keyValue={OVERFLOW}
  //     onChange={handleChange}
  //   />
  // );
};

export default SizeOverflow;
