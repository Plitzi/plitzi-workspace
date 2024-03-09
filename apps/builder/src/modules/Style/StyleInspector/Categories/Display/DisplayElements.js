// Packages
import React, { useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import noop from 'lodash/noop';

// Monorepo
import { ALIGN_ITEMS, DISPLAY, FLEX_DIRECTION, FLEX_WRAP, JUSTIFY_CONTENT } from '@plitzi/sdk-style/StyleConstants';

// Alias
import Icons from '@pcomponents/Icons';

// Relatives
import GroupButtons from '../../../components/GroupButtons';

const DisplayElements = props => {
  const { partialValue, onChange = noop } = props;

  const handleChange = useCallback(itemValue => onChange(itemValue.type, itemValue.value), [onChange]);

  const items = useMemo(
    () => [
      {
        value: { value: 'block', type: DISPLAY },
        children: <Icons type="DisplayBlock" width={16} height={16} />,
        description: 'Block elements start on a new line and take up the full available width.',
        active: partialValue === 'block'
      },
      {
        value: { value: 'flex', type: DISPLAY },
        children: <Icons type="DisplayFlex" width={16} height={16} />,
        description: 'Flex lays out its child elements on a horizontal or vertical axis.',
        active: partialValue === 'flex'
      },
      {
        value: { value: 'grid', type: DISPLAY },
        children: <Icons type="DisplayGrid" width={16} height={16} />,
        description: 'None hides elements.',
        active: partialValue === 'grid'
      },
      {
        value: { value: 'inline-block', type: DISPLAY },
        children: <Icons type="DisplayInlineBlock" width={16} height={16} />,
        description: 'Inline-block behaves like inline, but accepts width and height properties.',
        active: partialValue === 'inline-block'
      },
      {
        value: { value: 'inline', type: DISPLAY },
        children: <Icons type="DisplayInline" width={16} height={16} />,
        description: "Inline is the default for text content. The text's font size and line height determine its size",
        active: partialValue === 'inline'
      },
      {
        value: { value: 'none', type: DISPLAY },
        children: <Icons type="EyeOff" width={16} height={16} />,
        description: 'None hides elements.',
        active: partialValue === 'none'
      }
    ],
    [partialValue]
  );

  return (
    <GroupButtons
      classNameContainer="w-[180px]"
      items={items}
      label="Display"
      keyValue={[DISPLAY, FLEX_DIRECTION, ALIGN_ITEMS, JUSTIFY_CONTENT, FLEX_WRAP]}
      onChange={handleChange}
    />
  );
};

DisplayElements.propTypes = {
  partialValue: PropTypes.string,
  onChange: PropTypes.func
};

export default DisplayElements;
