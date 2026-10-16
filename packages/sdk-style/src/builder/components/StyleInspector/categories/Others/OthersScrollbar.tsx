import CategoryOption from '../../components/CategoryOption';
import CategorySection from '../../components/CategorySection';

import type { StyleCategory, StyleValue } from '@plitzi/sdk-shared';

export type OthersScrollbarProps = {
  scrollbarWidth?: StyleValue;
  scrollbarColor?: StyleValue;
  onChange?: (category: StyleCategory) => (value: StyleValue | Record<StyleCategory, StyleValue> | boolean) => void;
};

/** How a scrolling element's scrollbar looks: thin or hidden, and the thumb and track colours — in that order. */
const OthersScrollbar = ({ scrollbarWidth, scrollbarColor, onChange }: OthersScrollbarProps) => (
  <CategorySection label="">
    <CategoryOption
      keys={['scrollbar-width']}
      label="Scrollbar"
      value={scrollbarWidth}
      onChange={onChange?.('scrollbar-width')}
      type="select"
    >
      <option value="auto">Auto</option>
      <option value="thin">Thin</option>
      <option value="none">Hidden</option>
    </CategoryOption>
    <CategoryOption
      keys={['scrollbar-color']}
      label="Thumb / Track"
      value={scrollbarColor}
      onChange={onChange?.('scrollbar-color')}
      type="input"
    />
  </CategorySection>
);

export default OthersScrollbar;
