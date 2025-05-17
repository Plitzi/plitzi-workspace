import { useMemo } from 'react';

import { FONT_FAMILY } from '@plitzi/sdk-shared/style/StyleConstants';

import { defaultFonts } from './TypographyConstants';
import CategoryOption from '../../components/CategoryOption';
import CategorySection from '../../components/CategorySection';

import type { StyleCategory, StyleValue } from '@plitzi/sdk-shared';

export type TypographyFontProps = {
  partialValue?: StyleValue;
  fonts?: { name: string }[];
  onChange?: (value: StyleValue | Record<StyleCategory, StyleValue> | boolean) => void;
};

const TypographyFont = ({ partialValue, fonts, onChange }: TypographyFontProps) => {
  fonts = useMemo(() => [...(fonts ?? []), ...defaultFonts], [fonts]);

  return (
    <CategorySection label="F. Family" keys={[FONT_FAMILY]}>
      <CategoryOption value={partialValue} onChange={onChange} type="select">
        {fonts.map(font => (
          <option key={font.name} style={{ fontFamily: font.name }} value={font.name}>
            {font.name}
          </option>
        ))}
      </CategoryOption>
    </CategorySection>
  );
};

export default TypographyFont;
