import { TOP, BOTTOM, LEFT, RIGHT } from '@plitzi/sdk-shared/style/StyleConstants';

import CategoryOption from '../../components/CategoryOption';
import CategorySection from '../../components/CategorySection';

import type { StyleCategory, StyleValue } from '@plitzi/sdk-shared';

export type PositionAdvancedProps = {
  value?: Record<StyleCategory, StyleValue | undefined>;
  onChange?: (category: StyleCategory) => (value: StyleValue | Record<StyleCategory, StyleValue> | boolean) => void;
};

const units = [
  { label: 'PX', value: 'px' },
  { label: '%', value: '%' }
];

const allowedWords = ['auto'];

const PositionAdvanced = ({ value, onChange }: PositionAdvancedProps) => {
  const { [TOP]: top, [BOTTOM]: bottom, [LEFT]: left, [RIGHT]: right } = value ?? {};

  return (
    <CategorySection label="" keys={[TOP, BOTTOM, LEFT, RIGHT]} className="justify-center">
      <div className="grid grid-cols-3 gap-2 items-center justify-center place-items-center">
        <div className="col-start-2 flex items-center justify-center max-w-[80px]">
          <CategoryOption
            keys={[TOP]}
            value={top}
            onChange={onChange?.(TOP)}
            type="metric"
            units={units}
            allowedWords={allowedWords}
            className="text-center"
          />
        </div>
        <div className="row-start-2 flex items-center justify-self-end max-w-[80px]">
          <CategoryOption
            keys={[LEFT]}
            value={left}
            onChange={onChange?.(LEFT)}
            type="metric"
            units={units}
            allowedWords={allowedWords}
            className="text-center"
          />
        </div>
        <div className="row-start-2 grid grid-cols-3 gap-2 w-full h-24 place-items-center auto-rows-fr">
          <div className="col-start-2 bg-gray-300 w-0.5 h-full" />
          <div className="row-start-2 bg-gray-300 w-full h-0.5" />
          <div className="row-start-2 bg-gray-300 w-8 h-8 rounded" />
          <div className="row-start-2 bg-gray-300 w-full h-0.5" />
          <div className="col-start-2 row-start-3 bg-gray-300 w-0.5 h-full" />
        </div>
        <div className="row-start-2 flex items-center justify-self-start max-w-[80px]">
          <CategoryOption
            keys={[RIGHT]}
            value={right}
            onChange={onChange?.(RIGHT)}
            type="metric"
            units={units}
            allowedWords={allowedWords}
            className="text-center"
          />
        </div>
        <div className="col-start-2 row-start-3 flex items-center justify-center max-w-[80px]">
          <CategoryOption
            keys={[BOTTOM]}
            value={bottom}
            onChange={onChange?.(BOTTOM)}
            type="metric"
            units={units}
            allowedWords={allowedWords}
            className="text-center"
          />
        </div>
      </div>
    </CategorySection>
  );
};

export default PositionAdvanced;
