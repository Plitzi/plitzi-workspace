import ListCircles from '@plitzi/plitzi-ui/icons/ListCircles';
import ListDots from '@plitzi/plitzi-ui/icons/ListDots';
import ListLetters from '@plitzi/plitzi-ui/icons/ListLetters';
import ListNumbers from '@plitzi/plitzi-ui/icons/ListNumbers';
import ListRoman from '@plitzi/plitzi-ui/icons/ListRoman';
import ListSquares from '@plitzi/plitzi-ui/icons/ListSquares';
import XMark from '@plitzi/plitzi-ui/icons/XMark';
import { memo, useCallback, useMemo, use } from 'react';

import CategoryContainer from '../../components/CategoryContainer';
import CategoryOption from '../../components/CategoryOption';
import CategorySection from '../../components/CategorySection';
import useInspectorValues from '../../hooks/useInspectorValues';
import StyleInspectorContext from '../../StyleInspectorContext';

import type { StyleValue, StyleCategory } from '@plitzi/sdk-shared';

const dotKeys = ['list-style-type'] as StyleCategory[];

export type ListItemProps = {
  replaceTokens?: boolean;
  isCollapsed?: boolean;
  onCollapse?: (category: string, isCollapsed: boolean) => void;
};

const ListItem = ({ replaceTokens = false, isCollapsed = true, onCollapse }: ListItemProps) => {
  const { setValue } = use(StyleInspectorContext);
  const { ['list-style-type']: listItemStyle } = useInspectorValues({
    keys: dotKeys,
    asValue: true,
    replaceTokens
  });

  const handleCollapse = useCallback((isCollapsed: boolean) => onCollapse?.('listItem', isCollapsed), [onCollapse]);

  const handleChange = useCallback(
    (value: StyleValue | Record<StyleCategory, StyleValue> | boolean) =>
      setValue('list-style-type', value as StyleValue),
    [setValue]
  );

  const items = useMemo(
    () => [
      { value: 'none', icon: <XMark />, description: '', active: listItemStyle === 'none' },
      { value: 'disc', icon: <ListDots />, description: '', active: listItemStyle === 'disc' },
      { value: 'circle', icon: <ListCircles />, description: '', active: listItemStyle === 'circle' },
      { value: 'square', icon: <ListSquares />, description: '', active: listItemStyle === 'square' },
      { value: 'decimal', icon: <ListNumbers />, description: '', active: listItemStyle === 'decimal' },
      { value: 'lower-alpha', icon: <ListLetters />, description: '', active: listItemStyle === 'lower-alpha' },
      { value: 'lower-roman', icon: <ListRoman />, description: '', active: listItemStyle === 'lower-roman' }
    ],
    [listItemStyle]
  );

  return (
    <CategoryContainer title="List Item" dotKeys={dotKeys} isCollapsed={isCollapsed} onCollapse={handleCollapse}>
      <CategorySection keys={dotKeys} label="Style">
        <CategoryOption onChange={handleChange} type="iconGroup" items={items} />
      </CategorySection>
    </CategoryContainer>
  );
};

export default memo(ListItem);
