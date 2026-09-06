import { useCallback } from 'react';

import { fontFamilyStack, primaryFamily } from '@plitzi/sdk-shared/style';

import useSpaceFonts from '../../../../hooks/useSpaceFonts';
import CategoryOption from '../../components/CategoryOption';
import CategorySection from '../../components/CategorySection';

import type { StyleCategory, StyleValue } from '@plitzi/sdk-shared';

export type TypographyFontProps = {
  partialValue?: StyleValue;
  onChange?: (value: StyleValue | Record<StyleCategory, StyleValue> | boolean) => void;
};

const TypographyFont = ({ partialValue, onChange }: TypographyFontProps) => {
  const fonts = useSpaceFonts();
  const selected = typeof partialValue === 'string' ? primaryFamily(partialValue) : '';

  /**
   * The option is keyed by family and the declaration gets the whole stack.
   *
   * The two differ on purpose: the family is what the manifest is keyed by and what an older document holds on its
   * own, while the stack is what should reach the CSS — without it the browser has nothing to draw with until the
   * face arrives, and nothing at all if it never does.
   */
  const handleChange = useCallback(
    (value: StyleValue | Record<StyleCategory, StyleValue> | boolean) => {
      const font = fonts.find(item => item.family === value);
      onChange?.(font ? fontFamilyStack(font) : value);
    },
    [fonts, onChange]
  );

  return (
    <CategorySection label="F. Family" keys={['font-family']}>
      <CategoryOption value={selected} onChange={handleChange} type="select">
        {fonts.map(font => (
          <option key={font.family} style={{ fontFamily: fontFamilyStack(font) }} value={font.family}>
            {font.family}
          </option>
        ))}
      </CategoryOption>
    </CategorySection>
  );
};

export default TypographyFont;
