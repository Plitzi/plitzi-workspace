import { useCallback } from 'react';

import SpacingNumber from './SpacingNumber';
import SpacingPadding from './SpacingPadding';
import InspectorLabel from '../../components/InspectorLabel';

import type { StyleCategory, StyleValue } from '@plitzi/sdk-shared';

const keyValue = ['margin-top', 'margin-left', 'margin-right', 'margin-bottom'] as StyleCategory[];

export type SpacingMarginProps = {
  fragmentSelected?: StyleCategory;
  values?: {
    'margin-top'?: StyleValue;
    'margin-bottom'?: StyleValue;
    'margin-left'?: StyleValue;
    'margin-right'?: StyleValue;
    'padding-top'?: StyleValue;
    'padding-bottom'?: StyleValue;
    'padding-right'?: StyleValue;
    'padding-left'?: StyleValue;
  };
  isLinked?: boolean;
  onLinkSelected?: () => void;
  onSelectFragment?: (fragment?: StyleCategory) => void;
};

const SpacingMargin = ({
  fragmentSelected,
  values,
  isLinked = false,
  onLinkSelected,
  onSelectFragment
}: SpacingMarginProps) => {
  const handleClickSelect = useCallback(
    (type: StyleCategory) => () => {
      if (type === fragmentSelected) {
        onSelectFragment?.(undefined);
      } else {
        onSelectFragment?.(type);
      }
    },
    [fragmentSelected, onSelectFragment]
  );

  const {
    'margin-top': marginTop,
    'margin-bottom': marginBottom,
    'margin-left': marginLeft,
    'margin-right': marginRight
  } = values ?? {};

  return (
    <div className="relative flex cursor-pointer flex-col rounded-md border border-gray-300 bg-white select-none">
      <div className="flex items-center justify-center py-0.5">
        <InspectorLabel
          className="absolute top-0 left-0 overflow-hidden rounded-br-md !p-0 text-[10px]"
          size="custom"
          keyValue={keyValue}
        >
          MARGIN
        </InspectorLabel>
        <SpacingNumber
          value={marginTop}
          active={fragmentSelected === 'margin-top'}
          onClick={handleClickSelect('margin-top')}
        />
      </div>
      <div className="flex items-center justify-center">
        <div className="flex items-center justify-center px-0.5">
          <SpacingNumber
            value={marginLeft}
            active={fragmentSelected === 'margin-left'}
            onClick={handleClickSelect('margin-left')}
          />
        </div>
        <SpacingPadding
          values={values}
          fragmentSelected={fragmentSelected}
          onSelectFragment={onSelectFragment}
          isLinked={isLinked}
          onLinkSelected={onLinkSelected}
        />
        <div className="flex items-center justify-center px-0.5">
          <SpacingNumber
            value={marginRight}
            active={fragmentSelected === 'margin-right'}
            onClick={handleClickSelect('margin-right')}
          />
        </div>
      </div>
      <div className="flex items-center justify-center py-0.5">
        <SpacingNumber
          value={marginBottom}
          active={fragmentSelected === 'margin-bottom'}
          onClick={handleClickSelect('margin-bottom')}
        />
      </div>
    </div>
  );
};

export default SpacingMargin;
