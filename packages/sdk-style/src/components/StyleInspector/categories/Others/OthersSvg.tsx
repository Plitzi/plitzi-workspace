import CategoryOption from '../../components/CategoryOption';
import CategorySection from '../../components/CategorySection';

import type { StyleCategory, StyleValue } from '@plitzi/sdk-shared';

export type OthersSvgProps = {
  fill?: StyleValue;
  stroke?: StyleValue;
  strokeWidth?: StyleValue;
  onChange?: (category: StyleCategory) => (value: StyleValue | Record<StyleCategory, StyleValue> | boolean) => void;
};

const OthersSvg = ({ fill, stroke, strokeWidth, onChange }: OthersSvgProps) => {
  return (
    <CategorySection label="">
      <CategoryOption keys={['fill']} label="Fill" type="color" value={fill} onChange={onChange?.('fill')} />
      <CategoryOption keys={['stroke']} label="Stroke" type="color" value={stroke} onChange={onChange?.('stroke')} />
      <CategoryOption keys={['stroke-width']} label="Width" value={strokeWidth} onChange={onChange?.('stroke-width')} />
    </CategorySection>
  );
};

export default OthersSvg;
