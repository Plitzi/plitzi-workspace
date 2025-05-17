import AlignItemsBaselineColumn from '@plitzi/plitzi-ui/icons/AlignItemsBaselineColumn';
import AlignItemsBaselineColumnReverse from '@plitzi/plitzi-ui/icons/AlignItemsBaselineColumnReverse';
import AlignItemsBaselineRow from '@plitzi/plitzi-ui/icons/AlignItemsBaselineRow';
import AlignItemsBaselineRowReverse from '@plitzi/plitzi-ui/icons/AlignItemsBaselineRowReverse';
import AlignItemsCenterColumn from '@plitzi/plitzi-ui/icons/AlignItemsCenterColumn';
import AlignItemsCenterColumnReverse from '@plitzi/plitzi-ui/icons/AlignItemsCenterColumnReverse';
import AlignItemsCenterRow from '@plitzi/plitzi-ui/icons/AlignItemsCenterRow';
import AlignItemsCenterRowReverse from '@plitzi/plitzi-ui/icons/AlignItemsCenterRowReverse';
import AlignItemsEndColumn from '@plitzi/plitzi-ui/icons/AlignItemsEndColumn';
import AlignItemsEndColumnReverse from '@plitzi/plitzi-ui/icons/AlignItemsEndColumnReverse';
import AlignItemsEndRow from '@plitzi/plitzi-ui/icons/AlignItemsEndRow';
import AlignItemsEndRowReverse from '@plitzi/plitzi-ui/icons/AlignItemsEndRowReverse';
import AlignItemsStartColumn from '@plitzi/plitzi-ui/icons/AlignItemsStartColumn';
import AlignItemsStartColumnReverse from '@plitzi/plitzi-ui/icons/AlignItemsStartColumnReverse';
import AlignItemsStartRow from '@plitzi/plitzi-ui/icons/AlignItemsStartRow';
import AlignItemsStartRowReverse from '@plitzi/plitzi-ui/icons/AlignItemsStartRowReverse';
import AlignItemsStretchColumn from '@plitzi/plitzi-ui/icons/AlignItemsStretchColumn';
import AlignItemsStretchRow from '@plitzi/plitzi-ui/icons/AlignItemsStretchRow';
import { useCallback, useMemo } from 'react';

import { ALIGN_ITEMS } from '@plitzi/sdk-shared/style/StyleConstants';

import CategoryOption from '../../components/CategoryOption';
import CategorySection from '../../components/CategorySection';

import type { StyleCategory, StyleValue } from '@plitzi/sdk-shared';

export type DisplayFlexAlignItemsProps = {
  value?: StyleValue;
  isReverse: boolean;
  isRow: boolean;
  onChange?: (type: StyleCategory, value: StyleValue) => void;
};

const keyValues: StyleCategory[] = [ALIGN_ITEMS];

const DisplayFlexAlignItems = ({ value, isReverse = false, isRow = false, onChange }: DisplayFlexAlignItemsProps) => {
  const handleChange = useCallback(
    (newValue: StyleValue | Record<StyleCategory, StyleValue> | boolean) =>
      onChange?.(ALIGN_ITEMS, newValue as StyleValue),
    [onChange]
  );

  const getIcon = useCallback((value: string, isRow: boolean, isReverse: boolean) => {
    switch (value) {
      case 'flex-start':
        if (isRow && !isReverse) {
          return <AlignItemsStartRow />;
        }

        if (isRow && isReverse) {
          return <AlignItemsStartRowReverse />;
        }

        if (!isRow && !isReverse) {
          return <AlignItemsStartColumn />;
        }

        if (!isRow && isReverse) {
          return <AlignItemsStartColumnReverse />;
        }

        break;
      case 'center':
        if (isRow && !isReverse) {
          return <AlignItemsCenterRow />;
        }

        if (isRow && isReverse) {
          return <AlignItemsCenterRowReverse />;
        }

        if (!isRow && !isReverse) {
          return <AlignItemsCenterColumn />;
        }

        if (!isRow && isReverse) {
          return <AlignItemsCenterColumnReverse />;
        }

        break;
      case 'flex-end':
        if (isRow && !isReverse) {
          return <AlignItemsEndRow />;
        }

        if (isRow && isReverse) {
          return <AlignItemsEndRowReverse />;
        }

        if (!isRow && !isReverse) {
          return <AlignItemsEndColumn />;
        }

        if (!isRow && isReverse) {
          return <AlignItemsEndColumnReverse />;
        }

        break;
      case 'stretch':
        if (isRow) {
          return <AlignItemsStretchRow />;
        }

        return <AlignItemsStretchColumn />;
      case 'baseline':
        if (isRow && !isReverse) {
          return <AlignItemsBaselineRow />;
        }

        if (isRow && isReverse) {
          return <AlignItemsBaselineRowReverse />;
        }

        if (!isRow && !isReverse) {
          return <AlignItemsBaselineColumn />;
        }

        if (!isRow && isReverse) {
          return <AlignItemsBaselineColumnReverse />;
        }

        break;

      default:
        return undefined;
    }

    return undefined;
  }, []);

  const items = useMemo(
    () => [
      {
        value: 'flex-start',
        icon: getIcon('flex-start', isRow, isReverse),
        description: 'Align Start',
        active: value === 'flex-start'
      },
      {
        value: 'center',
        icon: getIcon('center', isRow, isReverse),
        description: 'Align Center',
        active: value === 'center'
      },
      {
        value: 'flex-end',
        icon: getIcon('flex-end', isRow, isReverse),
        description: 'Align End',
        active: value === 'flex-end'
      },
      {
        value: 'stretch',
        icon: getIcon('stretch', isRow, isReverse),
        description: 'Align Stretch',
        active: value === 'stretch'
      },
      {
        value: 'baseline',
        icon: getIcon('baseline', isRow, isReverse),
        description: 'Align Baseline',
        active: value === 'space-between'
      }
    ],
    [value, isReverse, isRow, getIcon]
  );

  return (
    <CategorySection keys={keyValues} label="Align">
      <CategoryOption onChange={handleChange} type="iconGroup" items={items} />
    </CategorySection>
  );
};

export default DisplayFlexAlignItems;
