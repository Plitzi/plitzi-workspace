import CategoryOption from '../../components/CategoryOption';
import CategorySection from '../../components/CategorySection';

import type { StyleCategory, StyleValue } from '@plitzi/sdk-shared';

export type OthersOutlineProps = {
  outlineWidth?: StyleValue;
  outlineStyle?: StyleValue;
  outlineColor?: StyleValue;
  outlineOffset?: StyleValue;
  onChange?: (category: StyleCategory) => (value: StyleValue | Record<StyleCategory, StyleValue> | boolean) => void;
};

const OthersOutline = ({ outlineWidth, outlineStyle, outlineColor, outlineOffset, onChange }: OthersOutlineProps) => {
  return (
    <>
      <CategorySection label="">
        <CategoryOption
          keys={['outline-style']}
          label="Outline"
          value={outlineStyle}
          onChange={onChange?.('outline-style')}
          type="select"
        >
          <option value="none">None</option>
          <option value="solid">Solid</option>
          <option value="dashed">Dashed</option>
          <option value="dotted">Dotted</option>
          <option value="double">Double</option>
          <option value="groove">Groove</option>
          <option value="ridge">Ridge</option>
          <option value="inset">Inset</option>
          <option value="outset">Outset</option>
        </CategoryOption>
        <CategoryOption
          keys={['outline-color']}
          label="Color"
          type="color"
          value={outlineColor}
          onChange={onChange?.('outline-color')}
        />
      </CategorySection>
      <CategorySection label="">
        <CategoryOption
          keys={['outline-width']}
          label="Width"
          value={outlineWidth}
          onChange={onChange?.('outline-width')}
          type="metric"
        />
        <CategoryOption
          keys={['outline-offset']}
          label="Offset"
          value={outlineOffset}
          onChange={onChange?.('outline-offset')}
          type="metric"
        />
      </CategorySection>
    </>
  );
};

export default OthersOutline;
