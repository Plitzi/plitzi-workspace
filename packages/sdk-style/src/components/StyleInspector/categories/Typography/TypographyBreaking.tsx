import CategoryAdvanced from '../../components/CategoryAdvanced';
import CategoryOption from '../../components/CategoryOption';
import CategorySection from '../../components/CategorySection';

import type { StyleCategory, StyleValue } from '@plitzi/sdk-shared';

export type TypographyBreakingProps = {
  whiteSpace?: StyleValue;
  textWrap?: StyleValue;
  wordBreak?: StyleValue;
  overflowWrap?: StyleValue;
  hyphens?: StyleValue;
  verticalAlign?: StyleValue;
  onChange?: (category: StyleCategory) => (value: StyleValue | Record<StyleCategory, StyleValue> | boolean) => void;
};

const TypographyBreaking = ({
  whiteSpace,
  textWrap,
  wordBreak,
  overflowWrap,
  hyphens,
  verticalAlign,
  onChange
}: TypographyBreakingProps) => {
  return (
    <>
      <CategorySection label="">
        <CategoryOption
          keys={['white-space']}
          label="Breaking"
          value={whiteSpace}
          onChange={onChange?.('white-space')}
          type="select"
        >
          <option value="normal">Normal</option>
          <option value="nowrap">No Wrap</option>
          <option value="pre">Pre</option>
          <option value="pre-wrap">Pre Wrap</option>
          <option value="pre-line">Pre Line</option>
          <option value="break-spaces">Break Spaces</option>
        </CategoryOption>
        <CategoryOption
          keys={['text-wrap']}
          label="Wrap"
          value={textWrap}
          onChange={onChange?.('text-wrap')}
          type="select"
        >
          <option value="wrap">Wrap</option>
          <option value="nowrap">No Wrap</option>
          <option value="balance">Balance</option>
          <option value="pretty">Pretty</option>
          <option value="stable">Stable</option>
        </CategoryOption>
      </CategorySection>
      <CategoryAdvanced>
        <CategorySection label="">
          <CategoryOption
            keys={['word-break']}
            label="Word Break"
            value={wordBreak}
            onChange={onChange?.('word-break')}
            type="select"
          >
            <option value="normal">Normal</option>
            <option value="break-all">Break All</option>
            <option value="keep-all">Keep All</option>
            <option value="break-word">Break Word</option>
          </CategoryOption>
          <CategoryOption
            keys={['overflow-wrap']}
            label="Overflow Wrap"
            value={overflowWrap}
            onChange={onChange?.('overflow-wrap')}
            type="select"
          >
            <option value="normal">Normal</option>
            <option value="break-word">Break Word</option>
            <option value="anywhere">Anywhere</option>
          </CategoryOption>
        </CategorySection>
        <CategorySection label="">
          <CategoryOption
            keys={['hyphens']}
            label="Hyphens"
            value={hyphens}
            onChange={onChange?.('hyphens')}
            type="select"
          >
            <option value="none">None</option>
            <option value="manual">Manual</option>
            <option value="auto">Auto</option>
          </CategoryOption>
          <CategoryOption
            keys={['vertical-align']}
            label="Vertical Align"
            value={verticalAlign}
            onChange={onChange?.('vertical-align')}
            type="select"
          >
            <option value="baseline">Baseline</option>
            <option value="top">Top</option>
            <option value="middle">Middle</option>
            <option value="bottom">Bottom</option>
            <option value="text-top">Text Top</option>
            <option value="text-bottom">Text Bottom</option>
            <option value="sub">Sub</option>
            <option value="super">Super</option>
          </CategoryOption>
        </CategorySection>
      </CategoryAdvanced>
    </>
  );
};

export default TypographyBreaking;
