import { memo, useCallback, use } from 'react';

import DisplayElements from './DisplayElements';
import DisplayFlex from './DisplayFlex';
import DisplayFlexAlignContent from './DisplayFlexAlignContent';
import DisplayFlexAlignItems from './DisplayFlexAlignItems';
import DisplayFlexDirection from './DisplayFlexDirection';
import DisplayFlexJustify from './DisplayFlexJustify';
import DisplayGap from './DisplayGap';
import DisplayGridGap from './DisplayGridGap';
import DisplayGridTemplate from './DisplayGridTemplate';
import CategoryContainer from '../../components/CategoryContainer';
import useInspectorValues from '../../hooks/useInspectorValues';
import StyleInspectorContext from '../../StyleInspectorContext';

import type { StyleCategory, StyleValue } from '@plitzi/sdk-shared';

const dotKeys = [
  'flex-direction',
  'flex-wrap',
  'align-items',
  'justify-content',
  'align-content',
  'column-gap',
  'row-gap',
  'grid-row-gap',
  'grid-column-gap',
  'grid-template-areas',
  'grid-template-columns',
  'grid-template-rows',
  'grid-auto-flow',
  'grid-auto-rows',
  'grid-auto-columns',
  'display'
] as StyleCategory[];

export type DisplayProps = {
  replaceTokens?: boolean;
  isCollapsed?: boolean;
  onCollapse?: (category: string, isCollapsed: boolean) => void;
};

const Display = ({ replaceTokens = false, isCollapsed = true, onCollapse }: DisplayProps) => {
  const { setValue } = use(StyleInspectorContext);
  const {
    display,
    'flex-direction': flexDirection,
    'flex-wrap': flexWrap,
    'align-items': alignItems,
    'justify-content': justifyContent,
    'row-gap': rowGap,
    'column-gap': columnGap,
    'grid-template-areas': gridTemplateAreas,
    'grid-template-columns': gridTemplateColumns,
    'grid-template-rows': gridTemplateRows,
    'grid-auto-flow': gridAutoFlow,
    'grid-auto-rows': gridAutoRows,
    'grid-auto-columns': gridAutoColumns,
    'grid-row-gap': gridRowGap,
    'grid-column-gap': gridColumnGap,
    'align-content': alignContent
  } = useInspectorValues({ keys: dotKeys, asValue: true, replaceTokens });

  const handleChange = useCallback(
    (type: StyleCategory, partialValue: StyleValue) => {
      if (type === 'display') {
        setValue(
          [
            'flex-direction',
            'flex-wrap',
            'align-items',
            'justify-content',
            'align-content',
            'column-gap',
            'row-gap',
            'grid-row-gap',
            'grid-column-gap',
            'grid-template-areas',
            'grid-template-columns',
            'grid-template-rows',
            'grid-auto-flow',
            'grid-auto-rows',
            'grid-auto-columns',
            'display'
          ] as const,
          {
            'flex-direction': undefined,
            'flex-wrap': undefined,
            'align-items': undefined,
            'justify-content': undefined,
            'align-content': undefined,
            'row-gap': undefined,
            'column-gap': undefined,
            'grid-row-gap': undefined,
            'grid-column-gap': undefined,
            'grid-template-areas': undefined,
            'grid-template-columns': undefined,
            'grid-template-rows': undefined,
            'grid-auto-flow': undefined,
            'grid-auto-rows': undefined,
            'grid-auto-columns': undefined,
            display: partialValue
          } as Record<StyleCategory, StyleValue | undefined>
        );
      } else {
        setValue(type, partialValue);
      }
    },
    [setValue]
  );

  const handleCollapse = useCallback((isCollapsed: boolean) => onCollapse?.('display', isCollapsed), [onCollapse]);

  const isReverse = typeof flexDirection === 'string' && flexDirection.includes('reverse');
  const isRow = typeof flexDirection === 'string' && flexDirection.includes('row');
  const isReverseWrap = typeof flexWrap === 'string' && flexWrap.includes('reverse');

  return (
    <CategoryContainer title="Layout" dotKeys={dotKeys} isCollapsed={isCollapsed} onCollapse={handleCollapse}>
      <DisplayElements value={display} onChange={handleChange} />
      {display === 'flex' && (
        <>
          <DisplayFlexDirection value={flexDirection} onChange={handleChange} isReverse={isReverse} />
          <DisplayFlexAlignItems value={alignItems} onChange={handleChange} isReverse={isReverse} isRow={isRow} />
          <DisplayFlexJustify value={justifyContent} onChange={handleChange} isReverse={isReverse} isRow={isRow} />
          <DisplayFlex value={flexWrap} onChange={handleChange} isReverse={isReverseWrap} />
          <DisplayGap rowGap={rowGap} columnGap={columnGap} onChange={handleChange} />
        </>
      )}
      {display === 'grid' && (
        <>
          <DisplayGridTemplate
            templateAreas={gridTemplateAreas}
            templateColumns={gridTemplateColumns}
            templateRows={gridTemplateRows}
            templateAutoFlow={gridAutoFlow}
            templateAutoRows={gridAutoRows}
            templateAutoColumns={gridAutoColumns}
            onChange={handleChange}
          />
          <DisplayGridGap rowGap={gridRowGap} columnGap={gridColumnGap} onChange={handleChange} />
        </>
      )}
      {display === 'flex' && (flexWrap === 'wrap' || flexWrap === 'wrap-reverse') && (
        <DisplayFlexAlignContent value={alignContent} onChange={handleChange} isReverse={isReverseWrap} isRow={isRow} />
      )}
    </CategoryContainer>
  );
};

export default memo(Display);
