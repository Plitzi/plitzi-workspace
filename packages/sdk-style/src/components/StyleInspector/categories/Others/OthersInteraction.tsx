import CategoryAdvanced from '../../components/CategoryAdvanced';
import CategoryOption from '../../components/CategoryOption';
import CategorySection from '../../components/CategorySection';

import type { StyleCategory, StyleValue } from '@plitzi/sdk-shared';

export type OthersInteractionProps = {
  pointerEvents?: StyleValue;
  userSelect?: StyleValue;
  touchAction?: StyleValue;
  resize?: StyleValue;
  appearance?: StyleValue;
  scrollBehavior?: StyleValue;
  overscrollBehavior?: StyleValue;
  onChange?: (category: StyleCategory) => (value: StyleValue | Record<StyleCategory, StyleValue> | boolean) => void;
};

const OthersInteraction = ({
  pointerEvents,
  userSelect,
  touchAction,
  resize,
  appearance,
  scrollBehavior,
  overscrollBehavior,
  onChange
}: OthersInteractionProps) => {
  return (
    <>
      <CategorySection label="">
        <CategoryOption
          keys={['pointer-events']}
          label="Pointer"
          value={pointerEvents}
          onChange={onChange?.('pointer-events')}
          type="select"
        >
          <option value="auto">Auto</option>
          <option value="none">None</option>
        </CategoryOption>
        <CategoryOption
          keys={['user-select']}
          label="Selection"
          value={userSelect}
          onChange={onChange?.('user-select')}
          type="select"
        >
          <option value="auto">Auto</option>
          <option value="none">None</option>
          <option value="text">Text</option>
          <option value="all">All</option>
          <option value="contain">Contain</option>
        </CategoryOption>
      </CategorySection>
      <CategoryAdvanced>
        <CategorySection label="">
          <CategoryOption
            keys={['touch-action']}
            label="Touch"
            value={touchAction}
            onChange={onChange?.('touch-action')}
            type="select"
          >
            <option value="auto">Auto</option>
            <option value="none">None</option>
            <option value="pan-x">Pan X</option>
            <option value="pan-y">Pan Y</option>
            <option value="manipulation">Manipulation</option>
          </CategoryOption>
          <CategoryOption keys={['resize']} label="Resize" value={resize} onChange={onChange?.('resize')} type="select">
            <option value="none">None</option>
            <option value="both">Both</option>
            <option value="horizontal">Horizontal</option>
            <option value="vertical">Vertical</option>
          </CategoryOption>
        </CategorySection>
        <CategorySection label="">
          <CategoryOption
            keys={['scroll-behavior']}
            label="Scroll"
            value={scrollBehavior}
            onChange={onChange?.('scroll-behavior')}
            type="select"
          >
            <option value="auto">Auto</option>
            <option value="smooth">Smooth</option>
          </CategoryOption>
          <CategoryOption
            keys={['overscroll-behavior']}
            label="Overscroll"
            value={overscrollBehavior}
            onChange={onChange?.('overscroll-behavior')}
            type="select"
          >
            <option value="auto">Auto</option>
            <option value="contain">Contain</option>
            <option value="none">None</option>
          </CategoryOption>
        </CategorySection>
        <CategorySection label="Appearance" keys={['appearance']}>
          <CategoryOption value={appearance} onChange={onChange?.('appearance')} type="select">
            <option value="auto">Auto</option>
            <option value="none">None</option>
          </CategoryOption>
        </CategorySection>
      </CategoryAdvanced>
    </>
  );
};

export default OthersInteraction;
