// Packages
import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
import noop from 'lodash/noop';

// Alias
import { MARGIN_TOP, MARGIN_BOTTOM, MARGIN_LEFT, MARGIN_RIGHT } from '@pmodules/Style/StyleConstants';

// Relatives
import InspectorLabel from '../../InspectorLabel';
import SpacingPadding from './SpacingPadding';
import SpacingNumber from './SpacingNumber';

const SpacingMargin = props => {
  const { fragmentSelected, partialValue, padding, onSelectFragment = noop } = props;

  const handleClickSelect = type => () => {
    const { fragmentSelected, onSelectFragment } = props;
    if (type === fragmentSelected) {
      onSelectFragment(null);
    } else {
      onSelectFragment(type);
    }
  };

  const {
    [MARGIN_TOP]: marginTop,
    [MARGIN_BOTTOM]: marginBottom,
    [MARGIN_LEFT]: marginLeft,
    [MARGIN_RIGHT]: marginRight
  } = partialValue;

  const keyValueMemo = useMemo(() => [MARGIN_TOP, MARGIN_LEFT, MARGIN_RIGHT, MARGIN_BOTTOM], []);

  return (
    <div className="flex flex-col bg-white border border-gray-300 rounded-md relative cursor-pointer select-none">
      <div className="flex justify-center items-center py-0.5">
        <InspectorLabel
          className="top-0 left-0 absolute text-[10px] overflow-hidden rounded-br-md !p-0"
          size="custom"
          keyValue={keyValueMemo}
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
          partialValue={padding}
          fragmentSelected={fragmentSelected}
          onSelectFragment={onSelectFragment}
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

SpacingMargin.propTypes = {
  partialValue: PropTypes.object,
  padding: PropTypes.object,
  fragmentSelected: PropTypes.string,
  onSelectFragment: PropTypes.func
};

export default SpacingMargin;
