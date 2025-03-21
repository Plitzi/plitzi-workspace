// Packages
import React, { useCallback } from 'react';
import noop from 'lodash/noop';

// Monorepo
import { PADDING_TOP, PADDING_BOTTOM, PADDING_LEFT, PADDING_RIGHT } from '@plitzi/sdk-shared/style';

// Relatives
import InspectorLabel from '../../InspectorLabel';
import SpacingNumber from './SpacingNumber';

const keyValue = [PADDING_TOP, PADDING_LEFT, PADDING_RIGHT, PADDING_BOTTOM];

/**
 * @param {{
 *   fragmentSelected?: string;
 *   values?: {
 *     paddingTop: string;
 *     paddingBottom: string;
 *     paddingLeft: string;
 *     paddingRight: string;
 *   };
 *   isLinked?: boolean;
 *   onLinkSelected?: () => void;
 *   onSelectFragment?: (fragment: string) => void;
 * }} props
 * @returns {React.ReactElement}
 */
const SpacingPadding = props => {
  const { fragmentSelected, values, isLinked = false, onLinkSelected = noop, onSelectFragment = noop } = props;

  const handleClickSelect = useCallback(
    type => () => {
      if (type === fragmentSelected) {
        onSelectFragment(undefined);
      } else {
        onSelectFragment(type);
      }
    },
    [onSelectFragment, fragmentSelected]
  );

  const {
    [PADDING_TOP]: paddingTop,
    [PADDING_BOTTOM]: paddingBottom,
    [PADDING_LEFT]: paddingLeft,
    [PADDING_RIGHT]: paddingRight
  } = values;

  return (
    <div className="relative border rounded-md border-gray-300 grow">
      <div className="flex justify-center items-center py-0.5">
        <InspectorLabel
          keyValue={keyValue}
          className="top-0 left-0 absolute text-[10px] overflow-hidden rounded-br-md !p-0"
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
      <div className="flex justify-center items-center">
        <div className="px-0.5 flex items-center justify-center">
          <SpacingNumber
            value={paddingLeft}
            active={fragmentSelected === PADDING_LEFT}
            onClick={handleClickSelect(PADDING_LEFT)}
          />
        </div>
        <div
          className="flex items-center justify-center py-1 bg-slate-100 grow border border-gray-300 rounded-md"
          onClick={onLinkSelected}
        >
          {isLinked && <i className="fa-solid fa-link text-sm" />}
          {!isLinked && <i className="fa-solid fa-link-slash text-sm" />}
        </div>
        <div className="px-0.5 flex items-center justify-center">
          <SpacingNumber
            value={paddingRight}
            active={fragmentSelected === PADDING_RIGHT}
            onClick={handleClickSelect(PADDING_RIGHT)}
          />
        </div>
      </div>
      <div className="flex justify-center items-center py-0.5">
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
