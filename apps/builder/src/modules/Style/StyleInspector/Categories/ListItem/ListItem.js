// Packages
import React, { memo, useCallback, use, useMemo } from 'react';
import noop from 'lodash/noop';

// Monorepo
import { LIST_ITEM_TYPE } from '@plitzi/sdk-shared/style';

// Alias
import Icons from '@pcomponents/Icons';

// Relatives
import StyleInspectorContext from '../../StyleInspectorContext';
import CategoryContainer from '../../../components/CategoryContainer';
import GroupButtons from '../../../components/GroupButtons';
import useInspectorValues from '../../hooks/useInspectorValues';

const LIST_ITEM_NONE = 'none';
const LIST_ITEM_DISC = 'disc';
const LIST_ITEM_CIRCLE = 'circle';
const LIST_ITEM_SQUARES = 'square';
const LIST_ITEM_DECIMAL = 'decimal';
const LIST_ITEM_LETTERS = 'lower-alpha';
const LIST_ITEM_ROMAN = 'lower-roman';

const dotKeys = [LIST_ITEM_TYPE];

/**
 * @param {{
 *   isCollapsed?: boolean;
 *   onCollapse?: (category: string, collapsed: boolean) => void;
 * }} props
 * @returns {React.ReactElement}
 */
const ListItem = props => {
  const { isCollapsed = true, onCollapse = noop } = props;
  const { setValue } = use(StyleInspectorContext);
  const listItemStyle = useInspectorValues({ keys: dotKeys, asValue: true });

  const handleCollapse = useCallback(isCollapsed => onCollapse('list', isCollapsed), [onCollapse]);

  const handleChange = useCallback(itemValue => setValue(itemValue.type, itemValue.value), [setValue]);

  const items = useMemo(
    () => [
      {
        value: { value: LIST_ITEM_NONE, type: LIST_ITEM_TYPE },
        children: <Icons width={16} height={16} type="XMark" />,
        description: '',
        active: listItemStyle === LIST_ITEM_NONE
      },
      {
        value: { value: LIST_ITEM_DISC, type: LIST_ITEM_TYPE },
        children: <Icons width={16} height={16} type="ListDots" />,
        description: '',
        active: listItemStyle === LIST_ITEM_DISC
      },
      {
        value: { value: LIST_ITEM_CIRCLE, type: LIST_ITEM_TYPE },
        children: <Icons width={16} height={16} type="ListCircles" />,
        description: '',
        active: listItemStyle === LIST_ITEM_CIRCLE
      },
      {
        value: { value: LIST_ITEM_SQUARES, type: LIST_ITEM_TYPE },
        children: <Icons width={16} height={16} type="ListSquares" />,
        description: '',
        active: listItemStyle === LIST_ITEM_SQUARES
      },
      {
        value: { value: LIST_ITEM_DECIMAL, type: LIST_ITEM_TYPE },
        children: <Icons width={16} height={16} type="ListNumbers" />,
        description: '',
        active: listItemStyle === LIST_ITEM_DECIMAL
      },
      {
        value: { value: LIST_ITEM_LETTERS, type: LIST_ITEM_TYPE },
        children: <Icons width={16} height={16} type="ListLetters" />,
        description: '',
        active: listItemStyle === LIST_ITEM_LETTERS
      },
      {
        value: { value: LIST_ITEM_ROMAN, type: LIST_ITEM_TYPE },
        children: <Icons width={16} height={16} type="ListRoman" />,
        description: '',
        active: listItemStyle === LIST_ITEM_ROMAN
      }
    ],
    [listItemStyle]
  );

  return (
    <CategoryContainer title="List Item" dotKeys={dotKeys} isCollapsed={isCollapsed} onCollapse={handleCollapse}>
      <div className="flex flex-col w-full p-2">
        <GroupButtons
          classNameContainer="w-[180px]"
          items={items}
          label="Style"
          keyValue={LIST_ITEM_TYPE}
          onChange={handleChange}
        />
      </div>
    </CategoryContainer>
  );
};

export default memo(ListItem);
