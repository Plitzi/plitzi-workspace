import { useCallback } from 'react';

import SpacingNumber from './SpacingNumber';
import InspectorLabel from '../../components/InspectorLabel';

import type { StyleCategory, StyleValue } from '@plitzi/sdk-shared';
import type { ReactNode } from 'react';

export type SpacingValues = Partial<
  Record<`${'margin' | 'padding'}-${'top' | 'bottom' | 'left' | 'right'}`, StyleValue>
>;

export type SpacingBoxProps = {
  property: 'margin' | 'padding';
  className: string;
  values?: SpacingValues;
  fragmentSelected?: StyleCategory;
  onSelectFragment?: (fragment?: StyleCategory) => void;
  /** What the ring goes around: the padding inside the margin, the link inside the padding. */
  children: ReactNode;
};

/** One ring of the box model: its four sides around what it holds, each picked to edit — and picked again, let go. */
const SpacingBox = ({ property, className, values, fragmentSelected, onSelectFragment, children }: SpacingBoxProps) => {
  const top: StyleCategory = `${property}-top`;
  const left: StyleCategory = `${property}-left`;
  const right: StyleCategory = `${property}-right`;
  const bottom: StyleCategory = `${property}-bottom`;

  const handleClickSelect = useCallback(
    (side: StyleCategory) => () => onSelectFragment?.(side === fragmentSelected ? undefined : side),
    [fragmentSelected, onSelectFragment]
  );

  return (
    <div className={className}>
      <div className="flex items-center justify-center py-0.5">
        <InspectorLabel
          className="absolute top-0 left-0 overflow-hidden rounded-br-md !p-0 text-[11px]"
          size="custom"
          keyValue={[top, left, right, bottom]}
        >
          {property.toUpperCase()}
        </InspectorLabel>
        <SpacingNumber value={values?.[top]} active={fragmentSelected === top} onClick={handleClickSelect(top)} />
      </div>
      <div className="flex items-center justify-center">
        <div className="flex items-center justify-center px-0.5">
          <SpacingNumber value={values?.[left]} active={fragmentSelected === left} onClick={handleClickSelect(left)} />
        </div>
        {children}
        <div className="flex items-center justify-center px-0.5">
          <SpacingNumber
            value={values?.[right]}
            active={fragmentSelected === right}
            onClick={handleClickSelect(right)}
          />
        </div>
      </div>
      <div className="flex items-center justify-center py-0.5">
        <SpacingNumber
          value={values?.[bottom]}
          active={fragmentSelected === bottom}
          onClick={handleClickSelect(bottom)}
        />
      </div>
    </div>
  );
};

export default SpacingBox;
