import { memo, useCallback, useMemo, use } from 'react';

import { LIST_KEYS } from '../../categoryKeys';
import CategoryContainer from '../../components/CategoryContainer';
import CategoryOption from '../../components/CategoryOption';
import CategorySection from '../../components/CategorySection';
import useInspectorValues from '../../hooks/useInspectorValues';
import StyleInspectorContext from '../../StyleInspectorContext';
import { listMarkerItems } from '../listMarkers';

import type { StyleValue, StyleCategory } from '@plitzi/sdk-shared';

export type ListProps = {
  replaceTokens?: boolean;
  isCollapsed?: boolean;
  onCollapse?: (category: string, isCollapsed: boolean) => void;
};

const List = ({ replaceTokens = false, isCollapsed = true, onCollapse }: ListProps) => {
  const { setValue } = use(StyleInspectorContext);
  const { ['list-style']: listStyle } = useInspectorValues({ keys: LIST_KEYS.dot, asValue: true, replaceTokens });

  const handleCollapse = useCallback((isCollapsed: boolean) => onCollapse?.('list', isCollapsed), [onCollapse]);

  const handleChange = useCallback(
    (value: StyleValue | Record<StyleCategory, StyleValue> | boolean) => setValue('list-style', value as StyleValue),
    [setValue]
  );

  const items = useMemo(() => listMarkerItems(listStyle), [listStyle]);

  return (
    <CategoryContainer
      title={LIST_KEYS.title}
      dotKeys={LIST_KEYS.dot}
      isCollapsed={isCollapsed}
      onCollapse={handleCollapse}
    >
      <CategorySection keys={LIST_KEYS.dot} label="Style">
        <CategoryOption onChange={handleChange} type="iconGroup" items={items} />
      </CategorySection>
    </CategoryContainer>
  );
};

export default memo(List);
