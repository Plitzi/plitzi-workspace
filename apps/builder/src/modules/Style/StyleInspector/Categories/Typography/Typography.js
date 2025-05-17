// Packages
import React, { memo, useCallback, use, useMemo } from 'react';
import noop from 'lodash/noop';

// Monorepo
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
} from '@plitzi/sdk-shared/style/StyleConstants';

// Relatives
import TypographyFont from './TypographyFont';
import TypographyTextShadow from './TypographyTextShadow';
import TypographyTransform from './TypographyTransform';
import TypographyStyle from './TypographyStyle';
import TypographyAlign from './TypographyAlign';
import StyleInspectorContext from '../../StyleInspectorContext';
import { defaultFonts } from './TypographyConstants';
import CategoryContainer from '../../../components/CategoryContainer';
import GroupButtons from '../../../components/GroupButtons';
import useInspectorValues from '../../hooks/useInspectorValues';

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
];

const weights = {
  100: 'Thin',
  200: 'Extra Light',
  300: 'Light',
  400: 'Normal',
  500: 'Medium',
  600: 'Semi Bold',
  700: 'Bold',
  800: 'Extra Bold',
  900: 'Black'
};

const fontsDefault = [];

const keyValueLetter = [LETTER_SPACING, TEXT_INDENT];
const keyValueWrap = [TEXT_WRAP, TEXT_OVERFLOW];

/**
 * @param {{
 *   isCollapsed?: boolean;
 *   fonts?: object[];
 *   onCollapse?: (category: string, isCollapsed: boolean) => void;
 * }} props
 * @returns {React.ReactElement}
 */
const Typography = props => {
  const { isCollapsed = true, fonts = fontsDefault, onCollapse = noop } = props;
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

  const handleCollapse = useCallback(isCollapsed => onCollapse('typography', isCollapsed), [onCollapse]);

  const fontSelected = [...fonts, ...defaultFonts].find(font => font.name === fontFamily);

  const handleChange = useCallback(itemValue => setValue(itemValue.type, itemValue.value), [setValue]);

  const itemsWeight = useMemo(
    () => [
      {
        type: 'select',
        value: fontWeight,
        extraValue: { type: FONT_WEIGHT },
        children: Object.keys(weights).map(w => (
          <option key={w} value={w} disabled={!fontSelected || !fontSelected.weights.includes(w)}>
            {weights[w]}
          </option>
        ))
      }
    ],
    [fontWeight, fontSelected]
  );

  const itemsColor = useMemo(() => [{ type: 'color', value: color, extraValue: { type: COLOR } }], [color]);

  const itemsSize = useMemo(
    () => [
      { type: 'inputMetric', value: fontSize, extraValue: { type: FONT_SIZE }, keyValue: FONT_SIZE, label: 'Size' },
      {
        type: 'inputMetric',
        value: lineHeight,
        extraValue: { type: LINE_HEIGHT },
        keyValue: LINE_HEIGHT,
        label: 'Line Height'
      }
    ],
    [fontSize, lineHeight]
  );

  const itemsSpacing = useMemo(
    () => [
      {
        type: 'inputMetric',
        value: letterSpacing,
        extraValue: { type: LETTER_SPACING },
        keyValue: LETTER_SPACING,
        label: 'Spacing'
      },
      {
        type: 'inputMetric',
        value: textIndent,
        extraValue: { type: TEXT_INDENT },
        keyValue: TEXT_INDENT,
        label: 'Indent'
      }
    ],
    [letterSpacing, textIndent]
  );

  const itemsBreaking = useMemo(
    () => [
      {
        type: 'select',
        value: whiteSpace,
        extraValue: { type: WHITE_SPACE },
        children: (
          <>
            <option value="normal">Normal</option>
            <option value="nowrap">No Wrap</option>
            <option value="pre">Pre</option>
            <option value="pre-wrap">Pre Wrap</option>
            <option value="pre-line">Pre Line</option>
            <option value="break-spaces">Break Spaces</option>
          </>
        )
      }
    ],
    [whiteSpace]
  );

  const itemsWrap = useMemo(
    () => [
      {
        type: 'select',
        value: textWrap,
        extraValue: { type: TEXT_WRAP },
        keyValue: TEXT_WRAP,
        children: (
          <>
            <option value="wrap">Wrap</option>
            <option value="nowrap">No Wrap</option>
            <option value="balance">Balance</option>
            <option value="pretty">Pretty</option>
            <option value="stable">Stable</option>
          </>
        ),
        label: 'Wrap'
      },
      {
        type: 'select',
        value: textOverflow,
        extraValue: { type: TEXT_OVERFLOW },
        keyValue: TEXT_OVERFLOW,
        children: (
          <>
            <option value="clip">Clip</option>
            <option value="ellipsis">Ellipsis</option>
            <option value="string">String</option>
            <option value="initial">Initial</option>
            <option value="inherit">Inherit</option>
          </>
        ),
        label: 'Overflow'
      }
    ],
    [textWrap, textOverflow]
  );

  return (
    <CategoryContainer title="Typography" dotKeys={dotKeys} isCollapsed={isCollapsed} onCollapse={handleCollapse}>
      <div className="flex flex-wrap p-2 gap-2">
        <TypographyAlign partialValue={textAlign} onChange={handleChange} />
        <TypographyFont partialValue={fontFamily} fonts={fonts} onChange={handleChange} />
        <GroupButtons
          className="w-full"
          classNameContainer="w-[180px]"
          keyValue={FONT_WEIGHT}
          items={itemsWeight}
          label="Weight"
          onChange={handleChange}
        />
        <GroupButtons
          className="w-full !justify-end"
          classNameContainer="w-[180px]"
          items={itemsSize}
          label=""
          onChange={handleChange}
        />
        <GroupButtons
          className="w-full"
          classNameContainer="w-[180px]"
          keyValue={COLOR}
          items={itemsColor}
          label="Color"
          onChange={handleChange}
        />
        <TypographyStyle fontStyle={fontStyle} textDecoration={textDecoration} onChange={handleChange} />
        <GroupButtons
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
        <TypographyTextShadow value={textShadow} onChange={handleChange} />
      </div>
    </CategoryContainer>
  );
};

export default memo(Typography);
