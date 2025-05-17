import { OBJECT_FIT } from '@plitzi/sdk-shared/style/StyleConstants';

import CategoryOption from '../../components/CategoryOption';
import CategorySection from '../../components/CategorySection';

import type { StyleCategory, StyleValue } from '@plitzi/sdk-shared';

const keyValues = [OBJECT_FIT] as StyleCategory[];

export type SizeFitProps = {
  value?: StyleValue;
  onChange?: (type: StyleCategory) => (value: StyleValue | Record<StyleCategory, StyleValue> | boolean) => void;
};

const SizeFit = ({ value, onChange }: SizeFitProps) => {
  return (
    <CategorySection label="Object Fit" keys={keyValues}>
      <CategoryOption keys={keyValues} label="" value={value} onChange={onChange?.(OBJECT_FIT)} type="select">
        <option value="fill">Fill</option>
        <option value="contain">Contain</option>
        <option value="cover">Cover</option>
        <option value="none">None</option>
        <option value="scale-down">Scale Down</option>
      </CategoryOption>
    </CategorySection>
  );
};

export default SizeFit;
