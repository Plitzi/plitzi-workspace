import { useCallback, useMemo, useState } from 'react';

import CategoryOption from '../../components/CategoryOption';
import CategorySection from '../../components/CategorySection';

import type { StyleCategory, StyleValue } from '@plitzi/sdk-shared';

const keyValues = [
  'border-top-left-radius',
  'border-top-right-radius',
  'border-bottom-left-radius',
  'border-bottom-right-radius'
] as StyleCategory[];

const units = [
  { label: 'PX', value: 'px' },
  { label: '%', value: '%' }
];

export type BorderRadiusProps = {
  values: Record<StyleCategory, StyleValue | undefined>;
  onChange?: (value: StyleValue | Record<StyleCategory, StyleValue> | boolean) => void;
  onChangeSegment?: (type: StyleCategory) => (value: StyleValue | Record<StyleCategory, StyleValue> | boolean) => void;
};

const BorderRadius = ({ values, onChange, onChangeSegment }: BorderRadiusProps) => {
  const {
    'border-top-left-radius': borderTopLeft,
    'border-top-right-radius': borderTopRight,
    'border-bottom-left-radius': borderBottomLeft,
    'border-bottom-right-radius': borderBottomRight
  } = values;
  const [showRadiusIndividuals, setShowRadiusIndividuals] = useState(
    borderTopLeft !== borderTopRight || borderTopLeft !== borderBottomLeft || borderTopLeft !== borderBottomRight
  );

  let all: StyleValue | undefined = '0px';
  if (borderTopLeft === borderTopRight && borderTopLeft === borderBottomLeft && borderTopLeft === borderBottomRight) {
    all = borderTopLeft;
  }

  const handleChange = useCallback((itemValue: StyleValue | Record<StyleCategory, StyleValue> | boolean) => {
    setShowRadiusIndividuals(itemValue as boolean);
  }, []);

  const items = useMemo(
    () => [
      { value: false, icon: 'fa-regular fa-square', description: '', active: !showRadiusIndividuals },
      { value: true, icon: 'fa-solid fa-expand', description: '', active: showRadiusIndividuals }
    ],
    [showRadiusIndividuals]
  );

  return (
    <div className="flex flex-col gap-2">
      <CategorySection label="Radius" keys={keyValues}>
        <CategoryOption items={items} type="iconGroup" onChange={handleChange} />
        <CategoryOption value={all} units={units} onChange={onChange} type="metric" />
      </CategorySection>
      {showRadiusIndividuals && (
        <div className="grid grid-cols-3 grid-cols-[1fr_auto_1fr] grid-rows-3">
          <div className="flex max-w-[80px] items-center justify-self-end">
            <CategoryOption
              value={borderTopLeft}
              onChange={onChangeSegment?.('border-top-left-radius')}
              type="metric"
              units={units}
              className="text-center"
            />
          </div>
          <div className="col-start-3 flex max-w-[80px] items-center justify-self-start">
            <CategoryOption
              value={borderTopRight}
              onChange={onChangeSegment?.('border-top-right-radius')}
              type="metric"
              units={units}
              className="text-center"
            />
          </div>
          <div className="col-start-2 row-start-2 flex items-center justify-center">
            <div className="grid h-10 w-10 grid-cols-2 grid-rows-2 gap-2">
              <div
                className="h-4 w-4 border-t-3 border-l-3"
                style={{
                  borderTopLeftRadius: borderTopLeft,
                  borderColor: borderTopLeft === '0px' ? 'currentColor' : '#5900D6'
                }}
              />
              <div
                className="h-4 w-4 border-t-3 border-r-3"
                style={{
                  borderTopRightRadius: borderTopRight,
                  borderColor: borderTopRight === '0px' ? 'currentColor' : '#5900D6'
                }}
              />
              <div
                className="h-4 w-4 border-b-3 border-l-3"
                style={{
                  borderBottomLeftRadius: borderBottomLeft,
                  borderColor: borderBottomLeft === '0px' ? 'currentColor' : '#5900D6'
                }}
              />
              <div
                className="h-4 w-4 border-r-3 border-b-3"
                style={{
                  borderBottomRightRadius: borderBottomRight,
                  borderColor: borderBottomRight === '0px' ? 'currentColor' : '#5900D6'
                }}
              />
            </div>
          </div>
          <div className="row-start-3 flex max-w-[80px] items-center justify-self-end">
            <CategoryOption
              value={borderBottomLeft}
              onChange={onChangeSegment?.('border-bottom-left-radius')}
              type="metric"
              units={units}
              className="text-center"
            />
          </div>
          <div className="col-start-3 row-start-3 flex max-w-[80px] items-center justify-self-start">
            <CategoryOption
              value={borderBottomRight}
              onChange={onChangeSegment?.('border-bottom-right-radius')}
              type="metric"
              units={units}
              className="text-center"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default BorderRadius;
