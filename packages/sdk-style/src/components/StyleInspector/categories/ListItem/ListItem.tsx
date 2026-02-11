import ListCircles from '@plitzi/plitzi-ui/icons/ListCircles';
import ListDots from '@plitzi/plitzi-ui/icons/ListDots';
import ListLetters from '@plitzi/plitzi-ui/icons/ListLetters';
import ListNumbers from '@plitzi/plitzi-ui/icons/ListNumbers';
import ListRoman from '@plitzi/plitzi-ui/icons/ListRoman';
import ListSquares from '@plitzi/plitzi-ui/icons/ListSquares';
import XMark from '@plitzi/plitzi-ui/icons/XMark';
import { memo, useCallback, useMemo, use } from 'react';

import { styleConstants } from '@plitzi/sdk-shared';

import CategoryContainer from '../../components/CategoryContainer';
import CategoryOption from '../../components/CategoryOption';
import CategorySection from '../../components/CategorySection';
import useInspectorValues from '../../hooks/useInspectorValues';
import StyleInspectorContext from '../../StyleInspectorContext';

import type { StyleValue, StyleCategory } from '@plitzi/sdk-shared';

const LIST_ITEM_NONE = 'none';
const LIST_ITEM_DISC = 'disc';
const LIST_ITEM_CIRCLE = 'circle';
const LIST_ITEM_SQUARES = 'square';
const LIST_ITEM_DECIMAL = 'decimal';
const LIST_ITEM_LETTERS = 'lower-alpha';
const LIST_ITEM_ROMAN = 'lower-roman';

const dotKeys = [styleConstants.LIST_STYLE_TYPE] as StyleCategory[];

export type ListItemProps = {
  replaceTokens?: boolean;
  isCollapsed?: boolean;
  onCollapse?: (category: string, isCollapsed: boolean) => void;
};

const ListItem = ({ replaceTokens = false, isCollapsed = true, onCollapse }: ListItemProps) => {
  const { setValue } = use(StyleInspectorContext);
  const { [styleConstants.LIST_STYLE_TYPE]: listItemStyle } = useInspectorValues({
    keys: dotKeys,
    asValue: true,
    replaceTokens
  });

  const handleCollapse = useCallback((isCollapsed: boolean) => onCollapse?.('listItem', isCollapsed), [onCollapse]);

  const handleChange = useCallback(
    (value: StyleValue | Record<StyleCategory, StyleValue> | boolean) =>
      setValue(styleConstants.LIST_STYLE_TYPE, value as StyleValue),
    [setValue]
  );

  const items = useMemo(
    () => [
      { value: LIST_ITEM_NONE, icon: <XMark />, description: '', active: listItemStyle === LIST_ITEM_NONE },
      { value: LIST_ITEM_DISC, icon: <ListDots />, description: '', active: listItemStyle === LIST_ITEM_DISC },
      { value: LIST_ITEM_CIRCLE, icon: <ListCircles />, description: '', active: listItemStyle === LIST_ITEM_CIRCLE },
      { value: LIST_ITEM_SQUARES, icon: <ListSquares />, description: '', active: listItemStyle === LIST_ITEM_SQUARES },
      { value: LIST_ITEM_DECIMAL, icon: <ListNumbers />, description: '', active: listItemStyle === LIST_ITEM_DECIMAL },
      { value: LIST_ITEM_LETTERS, icon: <ListLetters />, description: '', active: listItemStyle === LIST_ITEM_LETTERS },
      { value: LIST_ITEM_ROMAN, icon: <ListRoman />, description: '', active: listItemStyle === LIST_ITEM_ROMAN }
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
