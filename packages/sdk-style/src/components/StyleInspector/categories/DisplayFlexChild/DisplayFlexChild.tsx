/* eslint-disable quotes */
import FlexGrowRow from '@plitzi/plitzi-ui/icons/FlexGrowRow';
import FlexNoneRow from '@plitzi/plitzi-ui/icons/FlexNoneRow';
import FlexShrinkRow from '@plitzi/plitzi-ui/icons/FlexShrinkRow';
import isEqual from 'lodash/isEqual';
import { memo, useCallback, use, useMemo } from 'react';

import { ALIGN_SELF, ORDER, FLEX_GROW, FLEX_SHRINK, FLEX_BASIS } from '@plitzi/sdk-shared/style';

import DisplayAlignSelf from './DisplayAlignSelf';
import DisplayOrder from './DisplayOrder';
import CategoryContainer from '../../components/CategoryContainer';
import CategoryOption from '../../components/CategoryOption';
import CategorySection from '../../components/CategorySection';
import useInspectorValues from '../../hooks/useInspectorValues';
import StyleInspectorContext from '../../StyleInspectorContext';

import type { StyleCategory, StyleValue } from '@plitzi/sdk-shared';

const dotKeys: StyleCategory[] = [ALIGN_SELF, ORDER, FLEX_GROW, FLEX_SHRINK, FLEX_BASIS];

export type DisplayFlexChildProps = {
  isCollapsed?: boolean;
  isFlexVertical: boolean;
  onCollapse?: (category: string, isCollapsed: boolean) => void;
};

const keyValues: StyleCategory[] = [FLEX_GROW, FLEX_SHRINK, FLEX_BASIS];

const DisplayFlexChild = ({ isCollapsed = true, isFlexVertical = false, onCollapse }: DisplayFlexChildProps) => {
  const { setValue } = use(StyleInspectorContext);
  const {
    [FLEX_GROW]: flexGrow,
    [FLEX_SHRINK]: flexShrink,
    [FLEX_BASIS]: flexBasis,
    [ALIGN_SELF]: alignSelf,
    [ORDER]: order
  } = useInspectorValues({ keys: dotKeys, asValue: true });

  const handleChangeSizing = useCallback(
    (value: StyleValue | Record<StyleCategory, StyleValue> | boolean) => {
      setValue([FLEX_GROW, FLEX_SHRINK, FLEX_BASIS] as const, value as Record<StyleCategory, StyleValue>);
    },
    [setValue]
  );

  const handleChangeGrow = useCallback(
    (value: StyleValue | Record<StyleCategory, StyleValue> | boolean) => {
      setValue(FLEX_GROW, value as StyleValue);
    },
    [setValue]
  );

  const handleChangeShrink = useCallback(
    (value: StyleValue | Record<StyleCategory, StyleValue> | boolean) => {
      setValue(FLEX_SHRINK, value as StyleValue);
    },
    [setValue]
  );

  const handleChangeBasis = useCallback(
    (value: StyleValue | Record<StyleCategory, StyleValue> | boolean) => {
      setValue(FLEX_BASIS, value as StyleValue);
    },
    [setValue]
  );

  const handleCollapse = useCallback(
    (isCollapsed: boolean) => onCollapse?.('displayFlexChild', isCollapsed),
    [onCollapse]
  );

  const sizingItems = useMemo(() => {
    const customSizing =
      !(flexGrow === '0' && flexShrink === '1' && isEqual(flexBasis, 'auto')) &&
      !(flexGrow === '1' && flexShrink === '1' && isEqual(flexBasis, '0%')) &&
      !(flexGrow === '0' && flexShrink === '0' && isEqual(flexBasis, 'auto'));

    return [
      {
        value: { [FLEX_GROW]: '0', [FLEX_SHRINK]: '1', [FLEX_BASIS]: 'auto' } as Record<StyleCategory, StyleValue>,
        icon: <FlexShrinkRow />,
        description: 'Shrink if needed',
        active: !customSizing && flexGrow === '0' && flexShrink === '1' && isEqual(flexBasis, 'auto')
      },
      {
        value: { [FLEX_GROW]: '1', [FLEX_SHRINK]: '1', [FLEX_BASIS]: '0%' } as Record<StyleCategory, StyleValue>,
        icon: <FlexGrowRow />,
        description: 'Grow if possible',
        active: !customSizing && flexGrow === '1' && flexShrink === '1' && isEqual(flexBasis, '0%')
      },
      {
        value: { [FLEX_GROW]: '0', [FLEX_SHRINK]: '0', [FLEX_BASIS]: 'auto' } as Record<StyleCategory, StyleValue>,
        icon: <FlexNoneRow />,
        description: "Don't shrink or grow",
        active: !customSizing && flexGrow === '0' && flexShrink === '0' && isEqual(flexBasis, 'auto')
      }
    ];
  }, [flexGrow, flexShrink, flexBasis]);

  const handleChange = useCallback(
    (type: StyleCategory, partialValue: StyleValue) => setValue(type, partialValue),
    [setValue]
  );

  return (
    <CategoryContainer title="Flex Child" dotKeys={dotKeys} isCollapsed={isCollapsed} onCollapse={handleCollapse}>
      <CategoryOption
        keys={keyValues}
        label="Sizing"
        onChange={handleChangeSizing}
        type="iconGroup"
        items={sizingItems}
      />
      <CategorySection>
        <CategoryOption keys={[FLEX_GROW]} label="Grow" onChange={handleChangeGrow} type="input" value={flexGrow} />
        <CategoryOption
          keys={[FLEX_SHRINK]}
          label="Shrink"
          onChange={handleChangeShrink}
          type="input"
          value={flexShrink}
        />
        <CategoryOption
          keys={[FLEX_BASIS]}
          label="Basis"
          onChange={handleChangeBasis}
          type="metric"
          value={flexBasis}
        />
      </CategorySection>
      <DisplayAlignSelf value={alignSelf} isFlexVertical={isFlexVertical} onChange={handleChange} />
      <DisplayOrder value={order} onChange={handleChange} />
    </CategoryContainer>
  );
};

export default memo(DisplayFlexChild);
