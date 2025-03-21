// Packages
import React, { useCallback } from 'react';
import noop from 'lodash/noop';

// Monorepo
import { MARGIN_TOP, MARGIN_BOTTOM, MARGIN_LEFT, MARGIN_RIGHT } from '@plitzi/sdk-shared/style';

// Relatives
import InspectorLabel from '../../InspectorLabel';
import SpacingPadding from './SpacingPadding';
import SpacingNumber from './SpacingNumber';

const keyValue = [MARGIN_TOP, MARGIN_LEFT, MARGIN_RIGHT, MARGIN_BOTTOM];

/**
 * @param {{
 *   fragmentSelected?: string;
 *   values?: {
 *     marginTop: string;
 *     marginBottom: string;
 *     marginLeft: string;
 *     marginRight: string;
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
const SpacingMargin = props => {
  const { fragmentSelected, values, isLinked = false, onLinkSelected = noop, onSelectFragment = noop } = props;

  const handleClickSelect = useCallback(
    type => () => {
      const { fragmentSelected, onSelectFragment } = props;
      if (type === fragmentSelected) {
        onSelectFragment(undefined);
      } else {
        onSelectFragment(type);
      }
    },
    [fragmentSelected, onSelectFragment]
  );

  const {
    [MARGIN_TOP]: marginTop,
    [MARGIN_BOTTOM]: marginBottom,
    [MARGIN_LEFT]: marginLeft,
    [MARGIN_RIGHT]: marginRight
  } = values;

  return (
    <div className="flex flex-col bg-white border border-gray-300 rounded-md relative cursor-pointer select-none">
      <div className="flex justify-center items-center py-0.5">
        <InspectorLabel
          className="top-0 left-0 absolute text-[10px] overflow-hidden rounded-br-md !p-0"
          size="custom"
          keyValue={keyValue}
        >
          MARGIN
        </InspectorLabel>
        <SpacingNumber
          value={marginTop}
          active={fragmentSelected === MARGIN_TOP}
          onClick={handleClickSelect(MARGIN_TOP)}
        />
      </div>
      <div className="flex justify-center items-center">
        <div className="px-0.5 flex items-center justify-center">
          <SpacingNumber
            value={marginLeft}
            active={fragmentSelected === MARGIN_LEFT}
            onClick={handleClickSelect(MARGIN_LEFT)}
          />
        </div>
        <SpacingPadding
          values={values}
          fragmentSelected={fragmentSelected}
          onSelectFragment={onSelectFragment}
          isLinked={isLinked}
          onLinkSelected={onLinkSelected}
        />
        <div className="px-0.5 flex items-center justify-center">
          <SpacingNumber
            value={marginRight}
            active={fragmentSelected === MARGIN_RIGHT}
            onClick={handleClickSelect(MARGIN_RIGHT)}
          />
        </div>
      </div>
      <div className="flex justify-center items-center py-0.5">
        <SpacingNumber
          value={marginBottom}
          active={fragmentSelected === MARGIN_BOTTOM}
          onClick={handleClickSelect(MARGIN_BOTTOM)}
        />
      </div>
    </div>
  );
};

export default SpacingMargin;
