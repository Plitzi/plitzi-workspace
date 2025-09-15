import { memo, useCallback, use } from 'react';

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
  'font-family',
  'font-weight',
  'font-size',
  'line-height',
  'color',
  'text-align',
  'font-style',
  'text-decoration',
  'letter-spacing',
  'text-indent',
  'text-transform',
  'direction',
  'text-shadow',
  'white-space',
  'text-wrap',
  'text-overflow'
] as StyleCategory[];

const keyValueLetter = ['letter-spacing', 'text-indent'] as StyleCategory[];

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
    'text-indent': textIndent,
    'text-transform': textTransform,
    'text-shadow': textShadow,
    'white-space': whiteSpace,
    'text-wrap': textWrap,
    'text-overflow': textOverflow,
    'line-height': lineHeight,
    color,
    'letter-spacing': letterSpacing,
    direction
  } = useInspectorValues({ keys: dotKeys, asValue: true, replaceTokens });

  const handleCollapse = useCallback((isCollapsed: boolean) => onCollapse?.('typography', isCollapsed), [onCollapse]);

  const fontSelected = [...(fonts ?? []), ...defaultFonts].find(font => font.name === fontFamily);

  const handleChange = useCallback(
    (type: StyleCategory) => (value: StyleValue | Record<StyleCategory, StyleValue> | boolean) =>
      setValue(type, value as StyleValue),
    [setValue]
  );

  return (
    <CategoryContainer title="Typography" dotKeys={dotKeys} isCollapsed={isCollapsed} onCollapse={handleCollapse}>
      <TypographyAlign partialValue={textAlign} onChange={handleChange('text-align')} />
      <TypographyFont partialValue={fontFamily} fonts={fonts} onChange={handleChange('font-family')} />
      <CategorySection label="Weight" keys={['font-weight']}>
        <CategoryOption value={fontWeight} onChange={handleChange('font-weight')} type="select">
          {Object.keys(weights).map(weight => (
            <option key={weight} value={weight} disabled={!fontSelected || !fontSelected.weights.includes(weight)}>
              {weights[Number(weight)]}
            </option>
          ))}
        </CategoryOption>
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
      <CategorySection label="Color" keys={['color']}>
        <CategoryOption type="color" value={color} onChange={handleChange('color')} />
      </CategorySection>
      <TypographyStyle fontStyle={fontStyle} textDecoration={textDecoration} onChange={handleChange} />
      <CategorySection label="Letter" keys={keyValueLetter}>
        <CategoryOption
          keys={['letter-spacing']}
          label="Spacing"
          value={letterSpacing}
          onChange={handleChange('letter-spacing')}
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
      <CategorySection label="Breaking" keys={['white-space']}>
        <CategoryOption value={whiteSpace} onChange={handleChange('white-space')} type="select">
          <option value="normal">Normal</option>
          <option value="nowrap">No Wrap</option>
          <option value="pre">Pre</option>
          <option value="pre-wrap">Pre Wrap</option>
          <option value="pre-line">Pre Line</option>
          <option value="break-spaces">Break Spaces</option>
        </CategoryOption>
      </CategorySection>
      <CategorySection label="Wrap" keys={['text-wrap']}>
        <CategoryOption value={textWrap} onChange={handleChange('text-wrap')} type="select">
          <option value="wrap">Wrap</option>
          <option value="nowrap">No Wrap</option>
          <option value="balance">Balance</option>
          <option value="pretty">Pretty</option>
          <option value="stable">Stable</option>
        </CategoryOption>
      </CategorySection>
      <CategorySection label="Overflow" keys={['text-overflow']}>
        <CategoryOption value={textOverflow} onChange={handleChange('text-overflow')} type="select">
          <option value="clip">Clip</option>
          <option value="ellipsis">Ellipsis</option>
          <option value="string">String</option>
          <option value="initial">Initial</option>
          <option value="inherit">Inherit</option>
        </CategoryOption>
      </CategorySection>
      <TypographyTextShadow value={textShadow} onChange={handleChange('text-shadow')} />
    </CategoryContainer>
  );
};

export default memo(Typography);
