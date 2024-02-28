// Packages
import React, { memo, useCallback, useContext, useMemo } from 'react';
import PropTypes from 'prop-types';
import noop from 'lodash/noop';

// Alias
import { LIST_STYLE } from '@pmodules/Style/StyleConstants';
import Icons from '@pcomponents/Icons';

// Relatives
import StyleInspectorContext from '../../StyleInspectorContext';
import CategoryContainer from '../../../components/CategoryContainer';
import GroupButtons from '../../../components/GroupButtons';

const LIST_NONE = 'none';
const LIST_CIRCLE = 'circle';
const LIST_DECIMAL = 'decimal';
const LIST_DISC = 'disc';
const LIST_SQUARES = 'square';
const LIST_LETTERS = 'lower-alpha';
const LIST_ROMAN = 'lower-roman';

const dotKeys = [LIST_STYLE];

const List = props => {
  const { isCollapsed = true, onCollapse = noop } = props;
  const { getValue, setValue } = useContext(StyleInspectorContext);
  const style = getValue(LIST_STYLE);

  const handleCollapse = useCallback(isCollapsed => onCollapse('list', isCollapsed), [onCollapse]);

  const handleChange = useCallback(itemValue => setValue(itemValue.type, itemValue.value), [setValue]);

  const items = useMemo(
    () => [
      {
        value: { value: LIST_NONE, type: LIST_STYLE },
        children: <Icons width={16} height={16} type="XMark" />,
        description: '',
        active: style === LIST_NONE
      },
      {
        value: { value: LIST_DISC, type: LIST_STYLE },
        children: <Icons width={16} height={16} type="ListDots" />,
        description: '',
        active: style === LIST_DISC
      },
      {
        value: { value: LIST_CIRCLE, type: LIST_STYLE },
        children: <Icons width={16} height={16} type="ListCircles" />,
        description: '',
        active: style === LIST_CIRCLE
      },
      {
        value: { value: LIST_SQUARES, type: LIST_STYLE },
        children: <Icons width={16} height={16} type="ListSquares" />,
        description: '',
        active: style === LIST_SQUARES
      },
      {
        value: { value: LIST_DECIMAL, type: LIST_STYLE },
        children: <Icons width={16} height={16} type="ListNumbers" />,
        description: '',
        active: style === LIST_DECIMAL
      },
      {
        value: { value: LIST_LETTERS, type: LIST_STYLE },
        children: <Icons width={16} height={16} type="ListLetters" />,
        description: '',
        active: style === LIST_LETTERS
      },
      {
        value: { value: LIST_ROMAN, type: LIST_STYLE },
        children: <Icons width={16} height={16} type="ListRoman" />,
        description: '',
        active: style === LIST_ROMAN
      }
    ],
    [style]
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

List.propTypes = {
  isCollapsed: PropTypes.bool,
  onCollapse: PropTypes.func
};

export default memo(List);
