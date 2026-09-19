import CategoryOption from '../../components/CategoryOption';
import CategorySection from '../../components/CategorySection';

import type { StyleCategory, StyleValue } from '@plitzi/sdk-shared';

export type TypographyFiguresProps = {
  fontVariantNumeric?: StyleValue;
  fontFeatureSettings?: StyleValue;
  textFillColor?: StyleValue;
  onChange?: (category: StyleCategory) => (value: StyleValue | Record<StyleCategory, StyleValue> | boolean) => void;
};

/**
 * How figures and glyphs are drawn: numbers that line up in a column, the font's own optional features, and the fill
 * that text painted with its background (`background-clip: text`) needs made transparent.
 */
const TypographyFigures = ({
  fontVariantNumeric,
  fontFeatureSettings,
  textFillColor,
  onChange
}: TypographyFiguresProps) => (
  <>
    <CategorySection label="">
      <CategoryOption
        keys={['font-variant-numeric']}
        label="Numbers"
        value={fontVariantNumeric}
        onChange={onChange?.('font-variant-numeric')}
        type="select"
      >
        <option value="normal">Normal</option>
        <option value="tabular-nums">Tabular</option>
        <option value="proportional-nums">Proportional</option>
        <option value="lining-nums">Lining</option>
        <option value="oldstyle-nums">Old style</option>
        <option value="slashed-zero">Slashed zero</option>
        <option value="tabular-nums slashed-zero">Tabular, slashed zero</option>
      </CategoryOption>
      <CategoryOption
        keys={['-webkit-text-fill-color']}
        label="Text Fill"
        type="color"
        value={textFillColor}
        onChange={onChange?.('-webkit-text-fill-color')}
      />
    </CategorySection>
    <CategorySection label="">
      <CategoryOption
        keys={['font-feature-settings']}
        label="Font Features"
        value={fontFeatureSettings}
        onChange={onChange?.('font-feature-settings')}
        type="input"
      />
    </CategorySection>
  </>
);

export default TypographyFigures;
