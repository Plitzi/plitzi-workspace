import JustifyContentCenterColumn from '@plitzi/plitzi-ui/icons/JustifyContentCenterColumn';
import JustifyContentCenterRow from '@plitzi/plitzi-ui/icons/JustifyContentCenterRow';
import JustifyContentEndColumn from '@plitzi/plitzi-ui/icons/JustifyContentEndColumn';
import JustifyContentEndColumnReverse from '@plitzi/plitzi-ui/icons/JustifyContentEndColumnReverse';
import JustifyContentEndRow from '@plitzi/plitzi-ui/icons/JustifyContentEndRow';
import JustifyContentEndRowReverse from '@plitzi/plitzi-ui/icons/JustifyContentEndRowReverse';
import JustifyContentSpaceAroundColumn from '@plitzi/plitzi-ui/icons/JustifyContentSpaceAroundColumn';
import JustifyContentSpaceAroundRow from '@plitzi/plitzi-ui/icons/JustifyContentSpaceAroundRow';
import JustifyContentSpaceBetweenColumn from '@plitzi/plitzi-ui/icons/JustifyContentSpaceBetweenColumn';
import JustifyContentSpaceBetweenRow from '@plitzi/plitzi-ui/icons/JustifyContentSpaceBetweenRow';
import JustifyContentStartColumn from '@plitzi/plitzi-ui/icons/JustifyContentStartColumn';
import JustifyContentStartColumnReverse from '@plitzi/plitzi-ui/icons/JustifyContentStartColumnReverse';
import JustifyContentStartRow from '@plitzi/plitzi-ui/icons/JustifyContentStartRow';
import JustifyContentStartRowReverse from '@plitzi/plitzi-ui/icons/JustifyContentStartRowReverse';
import { useCallback, useMemo } from 'react';

import { JUSTIFY_CONTENT } from '@plitzi/sdk-shared/style';

import CategoryOption from '../../components/CategoryOption';

import type { StyleCategory, StyleValue } from '@plitzi/sdk-shared';

export type DisplayFlexJustifyProps = {
  value?: StyleValue;
  isReverse: boolean;
  isRow: boolean;
  onChange?: (type: string, value: StyleValue) => void;
};

const keyValues: StyleCategory[] = [JUSTIFY_CONTENT];

const DisplayFlexJustify = ({ value, isReverse = false, isRow = false, onChange }: DisplayFlexJustifyProps) => {
  const handleChange = useCallback(
    (newValue: StyleValue | boolean) => onChange?.(JUSTIFY_CONTENT, newValue as StyleValue),
    [onChange]
  );

  const getIcon = useCallback((value: string, isRow: boolean, isReverse: boolean) => {
    switch (value) {
      case 'flex-start':
        if (isRow && !isReverse) {
          return <JustifyContentStartRow />;
        }

        if (isRow && isReverse) {
          return <JustifyContentStartRowReverse />;
        }

        if (!isRow && !isReverse) {
          return <JustifyContentStartColumn />;
        }

        if (!isRow && isReverse) {
          return <JustifyContentStartColumnReverse />;
        }

        break;
      case 'center':
        if (isRow) {
          return <JustifyContentCenterRow />;
        }

        return <JustifyContentCenterColumn />;
      case 'flex-end':
        if (isRow && !isReverse) {
          return <JustifyContentEndRow />;
        }

        if (isRow && isReverse) {
          return <JustifyContentEndRowReverse />;
        }

        if (!isRow && !isReverse) {
          return <JustifyContentEndColumn />;
        }

        if (!isRow && isReverse) {
          return <JustifyContentEndColumnReverse />;
        }

        break;
      case 'space-between':
        if (isRow) {
          return <JustifyContentSpaceBetweenRow />;
        }

        return <JustifyContentSpaceBetweenColumn />;
      case 'space-around':
        if (isRow) {
          return <JustifyContentSpaceAroundRow />;
        }

        return <JustifyContentSpaceAroundColumn />;
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
        description: 'Justify Start',
        active: value === 'flex-start'
      },
      {
        value: 'center',
        icon: getIcon('center', isRow, isReverse),
        description: 'Justify Center',
        active: value === 'center'
      },
      {
        value: 'flex-end',
        icon: getIcon('flex-end', isRow, isReverse),
        description: 'Justify End',
        active: value === 'flex-end'
      },
      {
        value: 'space-between',
        icon: getIcon('space-between', isRow, isReverse),
        description: 'Justify Space Between - distribute evenly from start to end',
        active: value === 'space-between'
      },
      {
        value: 'space-around',
        icon: getIcon('space-around', isRow, isReverse),
        description: 'Justify Space Around - distribute evenly, why space around all children',
        active: value === 'space-around'
      }
    ],
    [getIcon, isRow, isReverse, value]
  );

  return <CategoryOption keys={keyValues} label="Justify" onChange={handleChange} type="iconGroup" items={items} />;
};

export default DisplayFlexJustify;
