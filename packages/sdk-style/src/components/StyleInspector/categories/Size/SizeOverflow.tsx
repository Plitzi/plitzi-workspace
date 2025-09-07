import { SizeOverflowScroll } from '@plitzi/plitzi-ui/icons';
import { useMemo } from 'react';

import { OVERFLOW } from '@plitzi/sdk-shared/style/styleConstants';

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
        icon: <div className="px-1 text-xs select-none">Auto</div>,
        description: '',
        active: value === 'auto',
        size: 'custom' as const
      }
    ],
    [value]
  );

  return (
    <CategorySection label="Overflow" keys={[OVERFLOW]}>
      <CategoryOption onChange={onChange?.(OVERFLOW)} type="iconGroup" items={items} />
    </CategorySection>
  );
};

export default SizeOverflow;
