/* eslint-disable quotes */
import FlexGrowRow from '@plitzi/plitzi-ui/icons/FlexGrowRow';
import FlexNoneRow from '@plitzi/plitzi-ui/icons/FlexNoneRow';
import FlexShrinkRow from '@plitzi/plitzi-ui/icons/FlexShrinkRow';
import { memo, useCallback, use, useMemo } from 'react';

import DisplayAlignSelf from './DisplayAlignSelf';
import DisplayOrder from './DisplayOrder';
import CategoryContainer from '../../components/CategoryContainer';
import CategoryOption from '../../components/CategoryOption';
import CategorySection from '../../components/CategorySection';
import useInspectorValues from '../../hooks/useInspectorValues';
import StyleInspectorContext from '../../StyleInspectorContext';

import type { StyleCategory, StyleValue } from '@plitzi/sdk-shared';

const dotKeys: StyleCategory[] = ['align-self', 'order', 'flex-grow', 'flex-shrink', 'flex-basis'];

export type DisplayFlexChildProps = {
  replaceTokens?: boolean;
  isCollapsed?: boolean;
  isFlexVertical: boolean;
  onCollapse?: (category: string, isCollapsed: boolean) => void;
};

const keyValues: StyleCategory[] = ['flex-grow', 'flex-shrink', 'flex-basis'];

const DisplayFlexChild = ({
  replaceTokens = false,
  isCollapsed = true,
  isFlexVertical = false,
  onCollapse
}: DisplayFlexChildProps) => {
  const { setValue } = use(StyleInspectorContext);
  const {
    'flex-grow': flexGrow,
    'flex-shrink': flexShrink,
    'flex-basis': flexBasis,
    'align-self': alignSelf,
    order
  } = useInspectorValues({ keys: dotKeys, asValue: true, replaceTokens });

  const handleChangeSizing = useCallback(
    (value: StyleValue | Record<StyleCategory, StyleValue> | boolean) => {
      setValue(['flex-grow', 'flex-shrink', 'flex-basis'] as const, value as Record<StyleCategory, StyleValue>);
    },
    [setValue]
  );

  const handleChangeGrow = useCallback(
    (value: StyleValue | Record<StyleCategory, StyleValue> | boolean) => {
      setValue('flex-grow', value as StyleValue);
    },
    [setValue]
  );

  const handleChangeShrink = useCallback(
    (value: StyleValue | Record<StyleCategory, StyleValue> | boolean) => {
      setValue('flex-shrink', value as StyleValue);
    },
    [setValue]
  );

  const handleChangeBasis = useCallback(
    (value: StyleValue | Record<StyleCategory, StyleValue> | boolean) => {
      setValue('flex-basis', value as StyleValue);
    },
    [setValue]
  );

  const handleCollapse = useCallback(
    (isCollapsed: boolean) => onCollapse?.('displayFlexChild', isCollapsed),
    [onCollapse]
  );

  const sizingItems = useMemo(() => {
    const customSizing =
      !(flexGrow === '0' && flexShrink === '1' && flexBasis === 'auto') &&
      !(flexGrow === '1' && flexShrink === '1' && flexBasis === '0%') &&
      !(flexGrow === '0' && flexShrink === '0' && flexBasis === 'auto');

    return [
      {
        value: { 'flex-grow': '0', 'flex-shrink': '1', 'flex-basis': 'auto' } as Record<StyleCategory, StyleValue>,
        icon: <FlexShrinkRow />,
        description: 'Shrink if needed',
        active: !customSizing && flexGrow === '0' && flexShrink === '1' && flexBasis === 'auto'
      },
      {
        value: { 'flex-grow': '1', 'flex-shrink': '1', 'flex-basis': '0%' } as Record<StyleCategory, StyleValue>,
        icon: <FlexGrowRow />,
        description: 'Grow if possible',
        active: !customSizing && flexGrow === '1' && flexShrink === '1' && flexBasis === '0%'
      },
      {
        value: { 'flex-grow': '0', 'flex-shrink': '0', 'flex-basis': 'auto' } as Record<StyleCategory, StyleValue>,
        icon: <FlexNoneRow />,
        description: "Don't shrink or grow",
        active: !customSizing && flexGrow === '0' && flexShrink === '0' && flexBasis === 'auto'
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
        <CategoryOption keys={['flex-grow']} label="Grow" onChange={handleChangeGrow} type="input" value={flexGrow} />
        <CategoryOption
          keys={['flex-shrink']}
          label="Shrink"
          onChange={handleChangeShrink}
          type="input"
          value={flexShrink}
        />
        <CategoryOption
          keys={['flex-basis']}
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
