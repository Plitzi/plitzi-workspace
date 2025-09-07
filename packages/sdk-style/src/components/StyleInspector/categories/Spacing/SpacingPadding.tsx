import { useCallback } from 'react';

import { PADDING_TOP, PADDING_BOTTOM, PADDING_LEFT, PADDING_RIGHT } from '@plitzi/sdk-shared/style/styleConstants';

import SpacingNumber from './SpacingNumber';
import InspectorLabel from '../../components/InspectorLabel';

import type { StyleCategory, StyleValue } from '@plitzi/sdk-shared';

const keyValue = [PADDING_TOP, PADDING_LEFT, PADDING_RIGHT, PADDING_BOTTOM] as StyleCategory[];

export type SpacingPaddingProps = {
  fragmentSelected?: StyleCategory;
  values?: {
    [PADDING_TOP]?: StyleValue;
    [PADDING_BOTTOM]?: StyleValue;
    [PADDING_LEFT]?: StyleValue;
    [PADDING_RIGHT]?: StyleValue;
  };
  isLinked?: boolean;
  onLinkSelected?: () => void;
  onSelectFragment?: (fragment?: StyleCategory) => void;
};

const SpacingPadding = ({
  fragmentSelected,
  values,
  isLinked = false,
  onLinkSelected,
  onSelectFragment
}: SpacingPaddingProps) => {
  const handleClickSelect = useCallback(
    (type?: StyleCategory) => () => {
      if (type === fragmentSelected) {
        onSelectFragment?.(undefined);
      } else {
        onSelectFragment?.(type);
      }
    },
    [onSelectFragment, fragmentSelected]
  );

  const {
    [PADDING_TOP]: paddingTop,
    [PADDING_BOTTOM]: paddingBottom,
    [PADDING_LEFT]: paddingLeft,
    [PADDING_RIGHT]: paddingRight
  } = values ?? {};

  return (
    <div className="relative grow rounded-md border border-gray-300">
      <div className="flex items-center justify-center py-0.5">
        <InspectorLabel
          keyValue={keyValue}
          className="absolute top-0 left-0 overflow-hidden rounded-br-md !p-0 text-[10px]"
          size="custom"
        >
          PADDING
        </InspectorLabel>
        <SpacingNumber
          value={paddingTop}
          active={fragmentSelected === PADDING_TOP}
          onClick={handleClickSelect(PADDING_TOP)}
        />
      </div>
      <div className="flex items-center justify-center">
        <div className="flex items-center justify-center px-0.5">
          <SpacingNumber
            value={paddingLeft}
            active={fragmentSelected === PADDING_LEFT}
            onClick={handleClickSelect(PADDING_LEFT)}
          />
        </div>
        <div
          className="flex grow items-center justify-center rounded-md border border-gray-300 bg-slate-100 py-1"
          onClick={onLinkSelected}
        >
          {isLinked && <i className="fa-solid fa-link text-sm" />}
          {!isLinked && <i className="fa-solid fa-link-slash text-sm" />}
        </div>
        <div className="flex items-center justify-center px-0.5">
          <SpacingNumber
            value={paddingRight}
            active={fragmentSelected === PADDING_RIGHT}
            onClick={handleClickSelect(PADDING_RIGHT)}
          />
        </div>
      </div>
      <div className="flex items-center justify-center py-0.5">
        <SpacingNumber
          value={paddingBottom}
          active={fragmentSelected === PADDING_BOTTOM}
          onClick={handleClickSelect(PADDING_BOTTOM)}
        />
      </div>
    </div>
  );
};

export default SpacingPadding;
