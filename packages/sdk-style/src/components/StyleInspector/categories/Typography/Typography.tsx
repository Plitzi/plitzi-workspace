import { memo, useCallback, use } from 'react';

import {
  FONT_FAMILY,
  FONT_WEIGHT,
  FONT_SIZE,
  LINE_HEIGHT,
  COLOR,
  TEXT_ALIGN,
  FONT_STYLE,
  TEXT_DECORATION,
  LETTER_SPACING,
  TEXT_INDENT,
  TEXT_TRANSFORM,
  DIRECTION,
  TEXT_SHADOW,
  WHITE_SPACE,
  TEXT_WRAP,
  TEXT_OVERFLOW
} from '@plitzi/sdk-shared/style/styleConstants';

import TypographyAlign from './TypographyAlign';
import { defaultFonts, weights } from './TypographyConstants';
import TypographyFont from './TypographyFont';
import TypographyStyle from './TypographyStyle';
import TypographyTextShadow from './TypographyTextShadow';
import TypographyTransform from './TypographyTransform';
import CategoryContainer from '../../components/CategoryContainer';
import CategoryOption from '../../components/CategoryOption';
import CategorySection from '../../components/CategorySection';
import useInspectorValues from '../../hooks/useInspectorValues';
import StyleInspectorContext from '../../StyleInspectorContext';

import type { StyleCategory, StyleValue } from '@plitzi/sdk-shared';

const dotKeys = [
  FONT_FAMILY,
  FONT_WEIGHT,
  FONT_SIZE,
  LINE_HEIGHT,
  COLOR,
  TEXT_ALIGN,
  FONT_STYLE,
  TEXT_DECORATION,
  LETTER_SPACING,
  TEXT_INDENT,
  TEXT_TRANSFORM,
  DIRECTION,
  TEXT_SHADOW,
  WHITE_SPACE,
  TEXT_WRAP,
  TEXT_OVERFLOW
] as StyleCategory[];

const keyValueLetter = [LETTER_SPACING, TEXT_INDENT] as StyleCategory[];

export type TypographyProps = {
  isCollapsed?: boolean;
  fonts?: { name: string; weights: string[] }[];
  onCollapse?: (category: string, isCollapsed: boolean) => void;
};

const Typography = ({ isCollapsed = true, fonts, onCollapse }: TypographyProps) => {
  const { setValue } = use(StyleInspectorContext);
  const {
    [FONT_FAMILY]: fontFamily,
    [FONT_WEIGHT]: fontWeight,
    [FONT_SIZE]: fontSize,
    [FONT_STYLE]: fontStyle,
    [TEXT_ALIGN]: textAlign,
    [TEXT_DECORATION]: textDecoration,
    [TEXT_INDENT]: textIndent,
    [TEXT_TRANSFORM]: textTransform,
    [TEXT_SHADOW]: textShadow,
    [WHITE_SPACE]: whiteSpace,
    [TEXT_WRAP]: textWrap,
    [TEXT_OVERFLOW]: textOverflow,
    [LINE_HEIGHT]: lineHeight,
    [COLOR]: color,
    [LETTER_SPACING]: letterSpacing,
    [DIRECTION]: direction
  } = useInspectorValues({ keys: dotKeys, asValue: true });

  const handleCollapse = useCallback((isCollapsed: boolean) => onCollapse?.('typography', isCollapsed), [onCollapse]);

  const fontSelected = [...(fonts ?? []), ...defaultFonts].find(font => font.name === fontFamily);

  const handleChange = useCallback(
    (type: StyleCategory) => (value: StyleValue | Record<StyleCategory, StyleValue> | boolean) =>
      setValue(type, value as StyleValue),
    [setValue]
  );

  return (
    <CategoryContainer title="Typography" dotKeys={dotKeys} isCollapsed={isCollapsed} onCollapse={handleCollapse}>
      <TypographyAlign partialValue={textAlign} onChange={handleChange(TEXT_ALIGN)} />
      <TypographyFont partialValue={fontFamily} fonts={fonts} onChange={handleChange(FONT_FAMILY)} />
      <CategorySection label="Weight" keys={[FONT_WEIGHT]}>
        <CategoryOption value={fontWeight} onChange={handleChange(FONT_WEIGHT)} type="select">
          {Object.keys(weights).map(weight => (
            <option key={weight} value={weight} disabled={!fontSelected || !fontSelected.weights.includes(weight)}>
              {weights[Number(weight)]}
            </option>
          ))}
        </CategoryOption>
      </CategorySection>
      <CategorySection label="">
        <CategoryOption
          keys={[FONT_SIZE]}
          label="Size"
          value={fontSize}
          onChange={handleChange(FONT_SIZE)}
          type="metric"
        />
        <CategoryOption
          keys={[LINE_HEIGHT]}
          label="Line Height"
          value={lineHeight}
          onChange={handleChange(LINE_HEIGHT)}
          type="metric"
        />
      </CategorySection>
      <CategorySection label="Color" keys={[COLOR]}>
        <CategoryOption type="color" value={color} onChange={handleChange(COLOR)} />
      </CategorySection>
      <TypographyStyle fontStyle={fontStyle} textDecoration={textDecoration} onChange={handleChange} />
      <CategorySection label="Letter" keys={keyValueLetter}>
        <CategoryOption
          keys={[LETTER_SPACING]}
          label="Spacing"
          value={letterSpacing}
          onChange={handleChange(LETTER_SPACING)}
          type="metric"
        />
        <CategoryOption
          keys={[TEXT_INDENT]}
          label="Indent"
          value={textIndent}
          onChange={handleChange(TEXT_INDENT)}
          type="metric"
        />
      </CategorySection>
      <TypographyTransform textTransform={textTransform} direction={direction} onChange={handleChange} />
      <CategorySection label="Breaking" keys={[WHITE_SPACE]}>
        <CategoryOption value={whiteSpace} onChange={handleChange(WHITE_SPACE)} type="select">
          <option value="normal">Normal</option>
          <option value="nowrap">No Wrap</option>
          <option value="pre">Pre</option>
          <option value="pre-wrap">Pre Wrap</option>
          <option value="pre-line">Pre Line</option>
          <option value="break-spaces">Break Spaces</option>
        </CategoryOption>
      </CategorySection>
      <CategorySection label="Wrap" keys={[TEXT_WRAP]}>
        <CategoryOption value={textWrap} onChange={handleChange(TEXT_WRAP)} type="select">
          <option value="wrap">Wrap</option>
          <option value="nowrap">No Wrap</option>
          <option value="balance">Balance</option>
          <option value="pretty">Pretty</option>
          <option value="stable">Stable</option>
        </CategoryOption>
      </CategorySection>
      <CategorySection label="Overflow" keys={[TEXT_OVERFLOW]}>
        <CategoryOption value={textOverflow} onChange={handleChange(TEXT_OVERFLOW)} type="select">
          <option value="clip">Clip</option>
          <option value="ellipsis">Ellipsis</option>
          <option value="string">String</option>
          <option value="initial">Initial</option>
          <option value="inherit">Inherit</option>
        </CategoryOption>
      </CategorySection>
      <TypographyTextShadow value={textShadow} onChange={handleChange(TEXT_SHADOW)} />
    </CategoryContainer>
  );
};

export default memo(Typography);
