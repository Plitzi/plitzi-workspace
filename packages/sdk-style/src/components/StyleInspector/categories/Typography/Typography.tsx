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
} from '@plitzi/sdk-shared/style';

import TypographyAlign from './TypographyAlign';
import { defaultFonts, weights } from './TypographyConstants';
import TypographyFont from './TypographyFont';
import TypographyStyle from './TypographyStyle';
// import TypographyTextShadow from './TypographyTextShadow';
// import TypographyTransform from './TypographyTransform';
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

// const keyValueLetter = [LETTER_SPACING, TEXT_INDENT];
// const keyValueWrap = [TEXT_WRAP, TEXT_OVERFLOW];

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
    // [TEXT_INDENT]: textIndent,
    // [TEXT_TRANSFORM]: textTransform,
    // [TEXT_SHADOW]: textShadow,
    // [WHITE_SPACE]: whiteSpace,
    // [TEXT_WRAP]: textWrap,
    // [TEXT_OVERFLOW]: textOverflow,
    [LINE_HEIGHT]: lineHeight,
    [COLOR]: color
    // [LETTER_SPACING]: letterSpacing,
    // [DIRECTION]: direction
  } = useInspectorValues({ keys: dotKeys, asValue: true });

  const handleCollapse = useCallback((isCollapsed: boolean) => onCollapse?.('typography', isCollapsed), [onCollapse]);

  const fontSelected = [...(fonts ?? []), ...defaultFonts].find(font => font.name === fontFamily);

  const handleChange = useCallback(
    (type: StyleCategory) => (value: StyleValue | Record<StyleCategory, StyleValue> | boolean) =>
      setValue(type, value as StyleValue),
    [setValue]
  );

  // const itemsSpacing = useMemo(
  //   () => [
  //     {
  //       type: 'inputMetric',
  //       value: letterSpacing,
  //       extraValue: { type: LETTER_SPACING },
  //       keyValue: LETTER_SPACING,
  //       label: 'Spacing'
  //     },
  //     {
  //       type: 'inputMetric',
  //       value: textIndent,
  //       extraValue: { type: TEXT_INDENT },
  //       keyValue: TEXT_INDENT,
  //       label: 'Indent'
  //     }
  //   ],
  //   [letterSpacing, textIndent]
  // );

  // const itemsBreaking = useMemo(
  //   () => [
  //     {
  //       type: 'select',
  //       value: whiteSpace,
  //       extraValue: { type: WHITE_SPACE },
  //       children: (
  //         <>
  //           <option value="normal">Normal</option>
  //           <option value="nowrap">No Wrap</option>
  //           <option value="pre">Pre</option>
  //           <option value="pre-wrap">Pre Wrap</option>
  //           <option value="pre-line">Pre Line</option>
  //           <option value="break-spaces">Break Spaces</option>
  //         </>
  //       )
  //     }
  //   ],
  //   [whiteSpace]
  // );

  // const itemsWrap = useMemo(
  //   () => [
  //     {
  //       type: 'select',
  //       value: textWrap,
  //       extraValue: { type: TEXT_WRAP },
  //       keyValue: TEXT_WRAP,
  //       children: (
  //         <>
  //           <option value="wrap">Wrap</option>
  //           <option value="nowrap">No Wrap</option>
  //           <option value="balance">Balance</option>
  //           <option value="pretty">Pretty</option>
  //           <option value="stable">Stable</option>
  //         </>
  //       ),
  //       label: 'Wrap'
  //     },
  //     {
  //       type: 'select',
  //       value: textOverflow,
  //       extraValue: { type: TEXT_OVERFLOW },
  //       keyValue: TEXT_OVERFLOW,
  //       children: (
  //         <>
  //           <option value="clip">Clip</option>
  //           <option value="ellipsis">Ellipsis</option>
  //           <option value="string">String</option>
  //           <option value="initial">Initial</option>
  //           <option value="inherit">Inherit</option>
  //         </>
  //       ),
  //       label: 'Overflow'
  //     }
  //   ],
  //   [textWrap, textOverflow]
  // );

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
      {/* <GroupButtons
          className="w-full"
          classNameContainer="w-[180px]"
          keyValue={COLOR}
          items={itemsColor}
          label="Color"
          onChange={handleChange}
        /> */}
      <TypographyStyle fontStyle={fontStyle} textDecoration={textDecoration} onChange={handleChange} />
      {/* <GroupButtons
          className="w-full"
          classNameContainer="w-[180px]"
          items={itemsSpacing}
          keyValue={keyValueLetter}
          label="Letter"
          onChange={handleChange}
        />
        <TypographyTransform textTransform={textTransform} direction={direction} onChange={handleChange} />
        <GroupButtons
          className="w-full"
          classNameContainer="w-[180px]"
          keyValue={WHITE_SPACE}
          items={itemsBreaking}
          label="Breaking"
          onChange={handleChange}
        />
        <GroupButtons
          className="w-full"
          classNameContainer="w-[180px]"
          items={itemsWrap}
          keyValue={keyValueWrap}
          label="Text"
          onChange={handleChange}
        />
        <TypographyTextShadow value={textShadow} onChange={handleChange} /> */}
    </CategoryContainer>
  );
};

export default memo(Typography);
