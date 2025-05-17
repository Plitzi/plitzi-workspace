// Packages
import React, { memo, useCallback, use, useMemo } from 'react';
import noop from 'lodash/noop';

// Monorepo
import { LIST_STYLE } from '@plitzi/sdk-shared/style/StyleConstants';

// Alias
import Icons from '@pcomponents/Icons';

// Relatives
import StyleInspectorContext from '../../StyleInspectorContext';
import CategoryContainer from '../../../components/CategoryContainer';
import GroupButtons from '../../../components/GroupButtons';
import useInspectorValues from '../../hooks/useInspectorValues';

const LIST_NONE = 'none';
const LIST_CIRCLE = 'circle';
const LIST_DECIMAL = 'decimal';
const LIST_DISC = 'disc';
const LIST_SQUARES = 'square';
const LIST_LETTERS = 'lower-alpha';
const LIST_ROMAN = 'lower-roman';

const dotKeys = [LIST_STYLE];

/**
 * @param {{
 *   isCollapsed?: boolean;
 *   onCollapse?: (type: string, isCollapsed: boolean) => void;
 * }} props
 * @returns {React.ReactElement}
 */
const List = props => {
  const { isCollapsed = true, onCollapse = noop } = props;
  const { setValue } = use(StyleInspectorContext);
  const listStyle = useInspectorValues({ keys: dotKeys, asValue: true });

  const handleCollapse = useCallback(isCollapsed => onCollapse('list', isCollapsed), [onCollapse]);

  const handleChange = useCallback(itemValue => setValue(itemValue.type, itemValue.value), [setValue]);

  const items = useMemo(
    () => [
      {
        value: { value: LIST_NONE, type: LIST_STYLE },
        children: <Icons width={16} height={16} type="XMark" />,
        description: '',
        active: listStyle === LIST_NONE
      },
      {
        value: { value: LIST_DISC, type: LIST_STYLE },
        children: <Icons width={16} height={16} type="ListDots" />,
        description: '',
        active: listStyle === LIST_DISC
      },
      {
        value: { value: LIST_CIRCLE, type: LIST_STYLE },
        children: <Icons width={16} height={16} type="ListCircles" />,
        description: '',
        active: listStyle === LIST_CIRCLE
      },
      {
        value: { value: LIST_SQUARES, type: LIST_STYLE },
        children: <Icons width={16} height={16} type="ListSquares" />,
        description: '',
        active: listStyle === LIST_SQUARES
      },
      {
        value: { value: LIST_DECIMAL, type: LIST_STYLE },
        children: <Icons width={16} height={16} type="ListNumbers" />,
        description: '',
        active: listStyle === LIST_DECIMAL
      },
      {
        value: { value: LIST_LETTERS, type: LIST_STYLE },
        children: <Icons width={16} height={16} type="ListLetters" />,
        description: '',
        active: listStyle === LIST_LETTERS
      },
      {
        value: { value: LIST_ROMAN, type: LIST_STYLE },
        children: <Icons width={16} height={16} type="ListRoman" />,
        description: '',
        active: listStyle === LIST_ROMAN
      }
    ],
    [listStyle]
  );

  return (
    <CategoryContainer title="List" dotKeys={dotKeys} isCollapsed={isCollapsed} onCollapse={handleCollapse}>
      <div className="flex flex-col w-full p-2">
        <GroupButtons
          classNameContainer="w-[180px]"
          items={items}
          label="Style"
          keyValue={LIST_STYLE}
          onChange={handleChange}
        />
      </div>
    </CategoryContainer>
  );
};

export default memo(List);
