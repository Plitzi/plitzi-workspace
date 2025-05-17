import TextDecorationOverline from '@plitzi/plitzi-ui/icons/TextDecorationOverline';
import XMark from '@plitzi/plitzi-ui/icons/XMark';
import { useMemo } from 'react';

import { FONT_STYLE, TEXT_DECORATION } from '@plitzi/sdk-shared/style/StyleConstants';

import CategoryOption from '../../components/CategoryOption';
import CategorySection from '../../components/CategorySection';

import type { StyleCategory, StyleValue } from '@plitzi/sdk-shared';

export type TypographyStyleProps = {
  fontStyle?: StyleValue;
  textDecoration?: StyleValue;
  onChange?: (category: StyleCategory) => (value: StyleValue | Record<StyleCategory, StyleValue> | boolean) => void;
};

const TypographyStyle = ({ fontStyle, textDecoration, onChange }: TypographyStyleProps) => {
  const itemsItalicize = useMemo(
    () => [
      {
        value: 'normal',
        icon: 'fa-solid fa-font',
        description: 'Normal',
        active: fontStyle === 'normal'
      },
      {
        value: 'italic',
        icon: 'fa-solid fa-italic',
        description: 'Italic',
        active: fontStyle === 'italic'
      }
    ],
    [fontStyle]
  );

  const itemsDecoration = useMemo(
    () => [
      {
        value: 'none',
        icon: <XMark />,
        description: 'None',
        active: textDecoration === 'none'
      },
      {
        value: 'line-through',
        icon: 'fa-solid fa-strikethrough',
        description: 'Strikethrough',
        active: textDecoration === 'line-through'
      },
      {
        value: 'underline',
        icon: 'fa-solid fa-underline',
        description: 'Underline',
        active: textDecoration === 'underline'
      },
      {
        value: 'overline',
        icon: <TextDecorationOverline />,
        description: 'Overline',
        active: textDecoration === 'overline'
      }
    ],
    [textDecoration]
  );

  return (
    <>
      <CategorySection label="Italicize" keys={[FONT_STYLE]}>
        <CategoryOption onChange={onChange?.(FONT_STYLE)} type="iconGroup" items={itemsItalicize} />
      </CategorySection>
      <CategorySection label="Decoration" keys={[TEXT_DECORATION]}>
        <CategoryOption onChange={onChange?.(TEXT_DECORATION)} type="iconGroup" items={itemsDecoration} />
      </CategorySection>
    </>
  );
};

export default TypographyStyle;
