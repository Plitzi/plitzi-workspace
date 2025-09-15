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
  const { top, bottom, left, right } = value ?? {};

  return (
    <CategorySection label="" keys={['top', 'bottom', 'left', 'right']} className="justify-center">
      <div className="grid grid-cols-3 place-items-center items-center justify-center gap-2">
        <div className="col-start-2 flex max-w-[80px] items-center justify-center">
          <CategoryOption
            keys={['top']}
            value={top}
            onChange={onChange?.('top')}
            type="metric"
            units={units}
            allowedWords={allowedWords}
            className="text-center"
          />
        </div>
        <div className="row-start-2 flex max-w-[80px] items-center justify-self-end">
          <CategoryOption
            keys={['left']}
            value={left}
            onChange={onChange?.('left')}
            type="metric"
            units={units}
            allowedWords={allowedWords}
            className="text-center"
          />
        </div>
        <div className="row-start-2 grid h-24 w-full auto-rows-fr grid-cols-3 place-items-center gap-2">
          <div className="col-start-2 h-full w-0.5 bg-gray-300" />
          <div className="row-start-2 h-0.5 w-full bg-gray-300" />
          <div className="row-start-2 h-8 w-8 rounded bg-gray-300" />
          <div className="row-start-2 h-0.5 w-full bg-gray-300" />
          <div className="col-start-2 row-start-3 h-full w-0.5 bg-gray-300" />
        </div>
        <div className="row-start-2 flex max-w-[80px] items-center justify-self-start">
          <CategoryOption
            keys={['right']}
            value={right}
            onChange={onChange?.('right')}
            type="metric"
            units={units}
            allowedWords={allowedWords}
            className="text-center"
          />
        </div>
        <div className="col-start-2 row-start-3 flex max-w-[80px] items-center justify-center">
          <CategoryOption
            keys={['bottom']}
            value={bottom}
            onChange={onChange?.('bottom')}
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
