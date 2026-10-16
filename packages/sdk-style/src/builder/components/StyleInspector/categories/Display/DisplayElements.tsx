/* eslint-disable quotes */
import DisplayBlock from '@plitzi/plitzi-ui/icons/DisplayBlock';
import DisplayFlex from '@plitzi/plitzi-ui/icons/DisplayFlex';
import DisplayGrid from '@plitzi/plitzi-ui/icons/DisplayGrid';
import DisplayInline from '@plitzi/plitzi-ui/icons/DisplayInline';
import DisplayInlineBlock from '@plitzi/plitzi-ui/icons/DisplayInlineBlock';
import { useCallback, useMemo } from 'react';

import CategoryOption from '../../components/CategoryOption';
import CategorySection from '../../components/CategorySection';

import type { StyleCategory, StyleValue } from '@plitzi/sdk-shared';

export type DisplayElementsProps = {
  value?: StyleValue;
  onChange?: (type: StyleCategory, value: StyleValue) => void;
};

const keyValues: StyleCategory[] = ['display', 'flex-direction', 'align-items', 'justify-content', 'flex-wrap'];

const DisplayElements = ({ value = 'block', onChange }: DisplayElementsProps) => {
  const handleChange = useCallback(
    (value: StyleValue | Record<StyleCategory, StyleValue> | boolean) => onChange?.('display', value as StyleValue),
    [onChange]
  );

  const items = useMemo(
    () => [
      {
        value: 'block',
        icon: <DisplayBlock />,
        description: 'Block elements start on a new line and take up the full available width.',
        active: value === 'block'
      },
      {
        value: 'flex',
        icon: <DisplayFlex />,
        description: 'Flex lays out its child elements on a horizontal or vertical axis.',
        active: value === 'flex'
      },
      {
        value: 'grid',
        icon: <DisplayGrid />,
        description: 'Grid lets place you items within rows and columns.',
        active: value === 'grid'
      },
      {
        value: 'inline-block',
        icon: <DisplayInlineBlock />,
        description: 'Inline-block behaves like inline, but accepts width and height properties.',
        active: value === 'inline-block'
      },
      {
        value: 'inline',
        icon: <DisplayInline />,
        description: "Inline is the default for text content. The text's font size and line height determine its size",
        active: value === 'inline'
      },
      {
        value: 'none',
        icon: 'fa-solid fa-eye-slash',
        description: 'None hides elements.',
        active: value === 'none'
      }
    ],
    [value]
  );

  return (
    <CategorySection keys={keyValues} label="Display">
      <CategoryOption onChange={handleChange} type="iconGroup" items={items} />
    </CategorySection>
  );
};

export default DisplayElements;
