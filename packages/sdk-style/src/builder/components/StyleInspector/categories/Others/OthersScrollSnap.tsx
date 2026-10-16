import CategoryOption from '../../components/CategoryOption';
import CategorySection from '../../components/CategorySection';

import type { StyleCategory, StyleValue } from '@plitzi/sdk-shared';

export type OthersScrollSnapProps = {
  scrollSnapType?: StyleValue;
  scrollSnapAlign?: StyleValue;
  scrollSnapStop?: StyleValue;
  scrollPaddingTop?: StyleValue;
  scrollMarginTop?: StyleValue;
  onChange?: (category: StyleCategory) => (value: StyleValue | Record<StyleCategory, StyleValue> | boolean) => void;
};

/**
 * Where scrolling comes to rest. On the box that scrolls, the axis it snaps on; on each child, where it lines up — a row
 * of cards that stops on a card, a carousel that stops on a slide. And for a page with a fixed header, the room an
 * anchor lands with (`scroll-padding-top` on the page, `scroll-margin-top` on the section).
 */
const OthersScrollSnap = ({
  scrollSnapType,
  scrollSnapAlign,
  scrollSnapStop,
  scrollPaddingTop,
  scrollMarginTop,
  onChange
}: OthersScrollSnapProps) => (
  <CategorySection label="Scroll snap">
    <CategoryOption
      keys={['scroll-snap-type']}
      label="Snap"
      value={scrollSnapType}
      onChange={onChange?.('scroll-snap-type')}
      type="select"
    >
      <option value="none">None</option>
      <option value="x mandatory">Across, always</option>
      <option value="x proximity">Across, when close</option>
      <option value="y mandatory">Down, always</option>
      <option value="y proximity">Down, when close</option>
    </CategoryOption>
    <CategoryOption
      keys={['scroll-snap-align']}
      label="Align"
      value={scrollSnapAlign}
      onChange={onChange?.('scroll-snap-align')}
      type="select"
    >
      <option value="none">None</option>
      <option value="start">Start</option>
      <option value="center">Center</option>
      <option value="end">End</option>
    </CategoryOption>
    <CategoryOption
      keys={['scroll-snap-stop']}
      label="Stop"
      value={scrollSnapStop}
      onChange={onChange?.('scroll-snap-stop')}
      type="select"
    >
      <option value="normal">Normal</option>
      <option value="always">Always</option>
    </CategoryOption>
    <CategoryOption
      keys={['scroll-padding-top']}
      label="Padding top"
      value={scrollPaddingTop}
      onChange={onChange?.('scroll-padding-top')}
      type="input"
    />
    <CategoryOption
      keys={['scroll-margin-top']}
      label="Margin top"
      value={scrollMarginTop}
      onChange={onChange?.('scroll-margin-top')}
      type="input"
    />
  </CategorySection>
);

export default OthersScrollSnap;
