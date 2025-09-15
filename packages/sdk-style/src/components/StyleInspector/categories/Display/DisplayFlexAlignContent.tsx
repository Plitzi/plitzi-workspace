import AlignContentCenterColumn from '@plitzi/plitzi-ui/icons/AlignContentCenterColumn';
import AlignContentCenterRow from '@plitzi/plitzi-ui/icons/AlignContentCenterRow';
import AlignContentEndColumn from '@plitzi/plitzi-ui/icons/AlignContentEndColumn';
import AlignContentEndReverseColumn from '@plitzi/plitzi-ui/icons/AlignContentEndReverseColumn';
import AlignContentEndReverseRow from '@plitzi/plitzi-ui/icons/AlignContentEndReverseRow';
import AlignContentEndRow from '@plitzi/plitzi-ui/icons/AlignContentEndRow';
import AlignContentSpaceAroundColumn from '@plitzi/plitzi-ui/icons/AlignContentSpaceAroundColumn';
import AlignContentSpaceAroundRow from '@plitzi/plitzi-ui/icons/AlignContentSpaceAroundRow';
import AlignContentSpaceBetweenColumn from '@plitzi/plitzi-ui/icons/AlignContentSpaceBetweenColumn';
import AlignContentSpaceBetweenRow from '@plitzi/plitzi-ui/icons/AlignContentSpaceBetweenRow';
import AlignContentStartColumn from '@plitzi/plitzi-ui/icons/AlignContentStartColumn';
import AlignContentStartReverseColumn from '@plitzi/plitzi-ui/icons/AlignContentStartReverseColumn';
import AlignContentStartReverseRow from '@plitzi/plitzi-ui/icons/AlignContentStartReverseRow';
import AlignContentStartRow from '@plitzi/plitzi-ui/icons/AlignContentStartRow';
import AlignContentStretchColumn from '@plitzi/plitzi-ui/icons/AlignContentStretchColumn';
import AlignContentStretchRow from '@plitzi/plitzi-ui/icons/AlignContentStretchRow';
import { useCallback, useMemo } from 'react';

import CategoryOption from '../../components/CategoryOption';
import CategorySection from '../../components/CategorySection';

import type { StyleCategory, StyleValue } from '@plitzi/sdk-shared';

export type DisplayFlexAlignContentProps = {
  value?: StyleValue;
  isReverse?: boolean;
  isRow?: boolean;
  onChange?: (type: StyleCategory, value: StyleValue) => void;
};

const keyValues: StyleCategory[] = ['align-content'];

const DisplayFlexAlignContent = ({
  value,
  isReverse = false,
  isRow = false,
  onChange
}: DisplayFlexAlignContentProps) => {
  const handleChange = useCallback(
    (newValue: StyleValue | Record<StyleCategory, StyleValue> | boolean) =>
      onChange?.('align-content', newValue as StyleValue),
    [onChange]
  );

  const getIcon = useCallback((value: string, isRow: boolean, isReverse: boolean) => {
    switch (value) {
      case 'flex-start':
        if (isRow && !isReverse) {
          return <AlignContentStartRow />;
        }

        if (isRow && isReverse) {
          return <AlignContentStartReverseRow />;
        }

        if (!isRow && !isReverse) {
          return <AlignContentStartColumn />;
        }

        if (!isRow && isReverse) {
          return <AlignContentStartReverseColumn />;
        }

        break;
      case 'center':
        if (isRow) {
          return <AlignContentCenterRow />;
        }

        return <AlignContentCenterColumn />;
      case 'flex-end':
        if (isRow && !isReverse) {
          return <AlignContentEndRow />;
        }

        if (isRow && isReverse) {
          return <AlignContentEndReverseRow />;
        }

        if (!isRow && !isReverse) {
          return <AlignContentEndColumn />;
        }

        if (!isRow && isReverse) {
          return <AlignContentEndReverseColumn />;
        }

        break;
      case 'stretch':
        if (isRow) {
          return <AlignContentStretchRow />;
        }

        return <AlignContentStretchColumn />;
      case 'space-between':
        if (isRow) {
          return <AlignContentSpaceBetweenRow />;
        }

        return <AlignContentSpaceBetweenColumn />;
      case 'space-around':
        if (isRow) {
          return <AlignContentSpaceAroundRow />;
        }

        return <AlignContentSpaceAroundColumn />;
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
        description: 'Align Rows: Start',
        active: value === 'flex-start'
      },
      {
        value: 'center',
        icon: getIcon('center', isRow, isReverse),
        description: 'Align Rows: Center',
        active: value === 'center'
      },
      {
        value: 'flex-end',
        icon: getIcon('flex-end', isRow, isReverse),
        description: 'Align Rows: End',
        active: value === 'flex-end'
      },
      {
        value: 'stretch',
        icon: getIcon('stretch', isRow, isReverse),
        description: 'Align Rows: Stretch',
        active: value === 'stretch'
      },
      {
        value: 'space-between',
        icon: getIcon('space-between', isRow, isReverse),
        description: 'Align Rows: Space Between',
        active: value === 'space-between'
      },
      {
        value: 'space-around',
        icon: getIcon('space-around', isRow, isReverse),
        description: 'Align Rows: Space Around',
        active: value === 'space-around'
      }
    ],
    [getIcon, isRow, isReverse, value]
  );

  return (
    <CategorySection keys={keyValues} label="Align">
      <CategoryOption onChange={handleChange} type="iconGroup" items={items} />
    </CategorySection>
  );
};

export default DisplayFlexAlignContent;
