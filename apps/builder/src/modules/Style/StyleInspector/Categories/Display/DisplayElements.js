// Packages
import React, { useCallback, useMemo } from 'react';
import noop from 'lodash/noop';

// Monorepo
import {
  ALIGN_ITEMS,
  DISPLAY,
  FLEX_DIRECTION,
  FLEX_WRAP,
  JUSTIFY_CONTENT
} from '@plitzi/sdk-shared/style/StyleConstants';

// Alias
import Icons from '@pcomponents/Icons';

// Relatives
import GroupButtons from '../../../components/GroupButtons';

/**
 * @param {{
 *   value: string;
 *   onChange?: (type: string, value: string) => void;
 * }} props
 * @returns {React.ReactElement}
 */
const DisplayElements = props => {
  const { value, onChange = noop } = props;

  const handleChange = useCallback(itemValue => onChange(itemValue.type, itemValue.value), [onChange]);

  const items = useMemo(
    () => [
      {
        value: { value: 'block', type: DISPLAY },
        children: <Icons type="DisplayBlock" width={16} height={16} />,
        description: 'Block elements start on a new line and take up the full available width.',
        active: value === 'block'
      },
      {
        value: { value: 'flex', type: DISPLAY },
        children: <Icons type="DisplayFlex" width={16} height={16} />,
        description: 'Flex lays out its child elements on a horizontal or vertical axis.',
        active: value === 'flex'
      },
      {
        value: { value: 'grid', type: DISPLAY },
        children: <Icons type="DisplayGrid" width={16} height={16} />,
        description: 'Grid lets place you items within rows and columns.',
        active: value === 'grid'
      },
      {
        value: { value: 'inline-block', type: DISPLAY },
        children: <Icons type="DisplayInlineBlock" width={16} height={16} />,
        description: 'Inline-block behaves like inline, but accepts width and height properties.',
        active: value === 'inline-block'
      },
      {
        value: { value: 'inline', type: DISPLAY },
        children: <Icons type="DisplayInline" width={16} height={16} />,
        description: "Inline is the default for text content. The text's font size and line height determine its size",
        active: value === 'inline'
      },
      {
        value: { value: 'none', type: DISPLAY },
        children: <Icons type="EyeOff" width={16} height={16} />,
        description: 'None hides elements.',
        active: value === 'none'
      }
    ],
    [value]
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

export default DisplayElements;
