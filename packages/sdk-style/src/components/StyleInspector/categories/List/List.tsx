import ListCircles from '@plitzi/plitzi-ui/icons/ListCircles';
import ListDots from '@plitzi/plitzi-ui/icons/ListDots';
import ListLetters from '@plitzi/plitzi-ui/icons/ListLetters';
import ListNumbers from '@plitzi/plitzi-ui/icons/ListNumbers';
import ListRoman from '@plitzi/plitzi-ui/icons/ListRoman';
import ListSquares from '@plitzi/plitzi-ui/icons/ListSquares';
import XMark from '@plitzi/plitzi-ui/icons/XMark';
import { memo, useCallback, useMemo, use } from 'react';

import { LIST_STYLE } from '@plitzi/sdk-shared';

import CategoryContainer from '../../components/CategoryContainer';
import CategoryOption from '../../components/CategoryOption';
import CategorySection from '../../components/CategorySection';
import useInspectorValues from '../../hooks/useInspectorValues';
import StyleInspectorContext from '../../StyleInspectorContext';

import type { StyleCategory, StyleValue } from '@plitzi/sdk-shared';

const LIST_NONE = 'none';
const LIST_CIRCLE = 'circle';
const LIST_DECIMAL = 'decimal';
const LIST_DISC = 'disc';
const LIST_SQUARES = 'square';
const LIST_LETTERS = 'lower-alpha';
const LIST_ROMAN = 'lower-roman';

const dotKeys = [LIST_STYLE] as StyleCategory[];

export type ListProps = {
  isCollapsed?: boolean;
  onCollapse?: (category: string, isCollapsed: boolean) => void;
};

const List = ({ isCollapsed = true, onCollapse }: ListProps) => {
  const { setValue } = use(StyleInspectorContext);
  const { [LIST_STYLE]: listStyle } = useInspectorValues({ keys: dotKeys, asValue: true });

  const handleCollapse = useCallback((isCollapsed: boolean) => onCollapse?.('list', isCollapsed), [onCollapse]);

  const handleChange = useCallback(
    (value: StyleValue | boolean) => setValue(LIST_STYLE, value as StyleValue),
    [setValue]
  );

  const items = useMemo(
    () => [
      { value: LIST_NONE, icon: <XMark />, description: '', active: listStyle === LIST_NONE },
      { value: LIST_DISC, icon: <ListDots />, description: '', active: listStyle === LIST_DISC },
      { value: LIST_CIRCLE, icon: <ListCircles />, description: '', active: listStyle === LIST_CIRCLE },
      { value: LIST_SQUARES, icon: <ListSquares />, description: '', active: listStyle === LIST_SQUARES },
      { value: LIST_DECIMAL, icon: <ListNumbers />, description: '', active: listStyle === LIST_DECIMAL },
      { value: LIST_LETTERS, icon: <ListLetters />, description: '', active: listStyle === LIST_LETTERS },
      { value: LIST_ROMAN, icon: <ListRoman />, description: '', active: listStyle === LIST_ROMAN }
    ],
    [listStyle]
  );

  return (
    <CategoryContainer title="List" dotKeys={dotKeys} isCollapsed={isCollapsed} onCollapse={handleCollapse}>
      <CategorySection keys={dotKeys} label="Style">
        <CategoryOption onChange={handleChange} type="iconGroup" items={items} />
      </CategorySection>
    </CategoryContainer>
  );
};

export default memo(List);
