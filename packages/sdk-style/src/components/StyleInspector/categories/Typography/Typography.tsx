import { memo, useCallback, use } from 'react';

import TypographyAlign from './TypographyAlign';
import TypographyBreaking from './TypographyBreaking';
import TypographyClamp from './TypographyClamp';
import { defaultFonts, weights } from './TypographyConstants';
import TypographyFont from './TypographyFont';
import TypographyStyle from './TypographyStyle';
import TypographyTextShadow from './TypographyTextShadow';
import TypographyTransform from './TypographyTransform';
import CategoryAdvanced from '../../components/CategoryAdvanced';
import CategoryContainer from '../../components/CategoryContainer';
import CategoryOption from '../../components/CategoryOption';
import CategorySection from '../../components/CategorySection';
import useInspectorValues from '../../hooks/useInspectorValues';
import StyleInspectorContext from '../../StyleInspectorContext';

import type { StyleCategory, StyleObject, StyleValue } from '@plitzi/sdk-shared';

const dotKeys = [
  'font-family',
  'font-weight',
  'font-size',
  'line-height',
  'color',
  'text-align',
  'font-style',
  'text-decoration',
  'text-decoration-thickness',
  'text-underline-offset',
  'letter-spacing',
  'word-spacing',
  'text-indent',
  'text-transform',
  'direction',
  'text-shadow',
  'white-space',
  'text-wrap',
  'word-break',
  'overflow-wrap',
  'hyphens',
  'vertical-align',
  'text-overflow',
  'line-clamp'
] as StyleCategory[];

const advancedKeys = [
  'text-decoration-thickness',
  'text-underline-offset',
  'word-break',
  'overflow-wrap',
  'hyphens',
  'vertical-align',
  'text-shadow'
] as StyleCategory[];

const keyValueLetter = ['letter-spacing', 'word-spacing', 'text-indent'] as StyleCategory[];

export type TypographyProps = {
  replaceTokens?: boolean;
  isCollapsed?: boolean;
  fonts?: { name: string; weights: string[] }[];
  onCollapse?: (category: string, isCollapsed: boolean) => void;
};

const Typography = ({ replaceTokens = false, isCollapsed = true, fonts, onCollapse }: TypographyProps) => {
  const { setValue } = use(StyleInspectorContext);
  const {
    'font-family': fontFamily,
    'font-weight': fontWeight,
    'font-size': fontSize,
    'font-style': fontStyle,
    'text-align': textAlign,
    'text-decoration': textDecoration,
    'text-decoration-thickness': textDecorationThickness,
    'text-underline-offset': textUnderlineOffset,
    'text-indent': textIndent,
    'text-transform': textTransform,
    'text-shadow': textShadow,
    'white-space': whiteSpace,
    'text-wrap': textWrap,
    'word-break': wordBreak,
    'overflow-wrap': overflowWrap,
    hyphens,
    'vertical-align': verticalAlign,
    'text-overflow': textOverflow,
    'line-clamp': lineClamp,
    'line-height': lineHeight,
    color,
    'letter-spacing': letterSpacing,
    'word-spacing': wordSpacing,
    direction
  } = useInspectorValues({ keys: dotKeys, asValue: true, replaceTokens });

  const handleCollapse = useCallback((isCollapsed: boolean) => onCollapse?.('typography', isCollapsed), [onCollapse]);

  const fontSelected = [...(fonts ?? []), ...defaultFonts].find(font => font.name === fontFamily);

  const handleChange = useCallback(
    (type: StyleCategory) => (value: StyleValue | Record<StyleCategory, StyleValue> | boolean) =>
      setValue(type, value as StyleValue),
    [setValue]
  );

  const handleChangeClamp = useCallback((values: StyleObject) => setValue(undefined, values), [setValue]);

  return (
    <CategoryContainer
      title="Typography"
      dotKeys={dotKeys}
      advancedKeys={advancedKeys}
      isCollapsed={isCollapsed}
      onCollapse={handleCollapse}
    >
      <TypographyAlign partialValue={textAlign} onChange={handleChange('text-align')} />
      <TypographyFont partialValue={fontFamily} fonts={fonts} onChange={handleChange('font-family')} />
      <CategorySection label="">
        <CategoryOption
          keys={['font-weight']}
          label="Weight"
          value={fontWeight}
          onChange={handleChange('font-weight')}
          type="select"
        >
          {Object.keys(weights).map(weight => (
            <option key={weight} value={weight} disabled={!fontSelected || !fontSelected.weights.includes(weight)}>
              {weights[Number(weight)]}
            </option>
          ))}
        </CategoryOption>
        <CategoryOption keys={['color']} label="Color" type="color" value={color} onChange={handleChange('color')} />
      </CategorySection>
      <CategorySection label="">
        <CategoryOption
          keys={['font-size']}
          label="Size"
          value={fontSize}
          onChange={handleChange('font-size')}
          type="metric"
        />
        <CategoryOption
          keys={['line-height']}
          label="Line Height"
          value={lineHeight}
          onChange={handleChange('line-height')}
          type="metric"
        />
      </CategorySection>
      <TypographyStyle
        fontStyle={fontStyle}
        textDecoration={textDecoration}
        textDecorationThickness={textDecorationThickness}
        textUnderlineOffset={textUnderlineOffset}
        onChange={handleChange}
      />
      <CategorySection label="Letter" keys={keyValueLetter}>
        <CategoryOption
          keys={['letter-spacing']}
          label="Spacing"
          value={letterSpacing}
          onChange={handleChange('letter-spacing')}
          type="metric"
        />
        <CategoryOption
          keys={['word-spacing']}
          label="Word"
          value={wordSpacing}
          onChange={handleChange('word-spacing')}
          type="metric"
        />
        <CategoryOption
          keys={['text-indent']}
          label="Indent"
          value={textIndent}
          onChange={handleChange('text-indent')}
          type="metric"
        />
      </CategorySection>
      <TypographyTransform textTransform={textTransform} direction={direction} onChange={handleChange} />
      <TypographyBreaking
        whiteSpace={whiteSpace}
        textWrap={textWrap}
        wordBreak={wordBreak}
        overflowWrap={overflowWrap}
        hyphens={hyphens}
        verticalAlign={verticalAlign}
        onChange={handleChange}
      />
      <CategorySection label="">
        <CategoryOption
          keys={['text-overflow']}
          label="Overflow"
          value={textOverflow}
          onChange={handleChange('text-overflow')}
          type="select"
        >
          <option value="clip">Clip</option>
          <option value="ellipsis">Ellipsis</option>
          <option value="string">String</option>
          <option value="initial">Initial</option>
          <option value="inherit">Inherit</option>
        </CategoryOption>
        <TypographyClamp value={lineClamp} onChange={handleChangeClamp} />
      </CategorySection>
      <CategoryAdvanced>
        <TypographyTextShadow value={textShadow} onChange={handleChange('text-shadow')} />
      </CategoryAdvanced>
    </CategoryContainer>
  );
};

export default memo(Typography);
