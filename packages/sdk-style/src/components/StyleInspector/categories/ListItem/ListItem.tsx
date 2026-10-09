import { memo, useCallback, useMemo, use } from 'react';

import { LIST_ITEM_KEYS } from '../../categoryKeys';
import CategoryContainer from '../../components/CategoryContainer';
import CategoryOption from '../../components/CategoryOption';
import CategorySection from '../../components/CategorySection';
import useInspectorValues from '../../hooks/useInspectorValues';
import StyleInspectorContext from '../../StyleInspectorContext';
import { listMarkerItems } from '../listMarkers';

import type { StyleValue, StyleCategory } from '@plitzi/sdk-shared';

export type ListItemProps = {
  replaceTokens?: boolean;
  isCollapsed?: boolean;
  onCollapse?: (category: string, isCollapsed: boolean) => void;
};

const ListItem = ({ replaceTokens = false, isCollapsed = true, onCollapse }: ListItemProps) => {
  const { setValue } = use(StyleInspectorContext);
  const { ['list-style-type']: listItemStyle } = useInspectorValues({
    keys: LIST_ITEM_KEYS.dot,
    asValue: true,
    replaceTokens
  });

  const handleCollapse = useCallback((isCollapsed: boolean) => onCollapse?.('listItem', isCollapsed), [onCollapse]);

  const handleChange = useCallback(
    (value: StyleValue | Record<StyleCategory, StyleValue> | boolean) =>
      setValue('list-style-type', value as StyleValue),
    [setValue]
  );

  const items = useMemo(() => listMarkerItems(listItemStyle), [listItemStyle]);

  return (
    <CategoryContainer
      title={LIST_ITEM_KEYS.title}
      dotKeys={LIST_ITEM_KEYS.dot}
      isCollapsed={isCollapsed}
      onCollapse={handleCollapse}
    >
      <CategorySection keys={LIST_ITEM_KEYS.dot} label="Style">
        <CategoryOption onChange={handleChange} type="iconGroup" items={items} />
      </CategorySection>
    </CategoryContainer>
  );
};

export default memo(ListItem);
