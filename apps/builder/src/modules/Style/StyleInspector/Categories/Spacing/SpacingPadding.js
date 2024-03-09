// Packages
import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
import noop from 'lodash/noop';

// Monorepo
import { PADDING_TOP, PADDING_BOTTOM, PADDING_LEFT, PADDING_RIGHT } from '@plitzi/sdk-style/StyleConstants';

// Relatives
import InspectorLabel from '../../InspectorLabel';
import SpacingNumber from './SpacingNumber';

const SpacingPadding = props => {
  const { fragmentSelected, partialValue, onSelectFragment = noop } = props;
  const handleClickSelect = type => () => {
    if (type === fragmentSelected) {
      onSelectFragment(undefined);
    } else {
      onSelectFragment(type);
    }
  };

  const {
    [PADDING_TOP]: paddingTop,
    [PADDING_BOTTOM]: paddingBottom,
    [PADDING_LEFT]: paddingLeft,
    [PADDING_RIGHT]: paddingRight
  } = partialValue;

  const keyValueMemo = useMemo(() => [PADDING_TOP, PADDING_LEFT, PADDING_RIGHT, PADDING_BOTTOM], []);

  return (
    <div className="relative border rounded-md border-gray-300 grow">
      <div className="flex justify-center items-center py-0.5">
        <InspectorLabel
          keyValue={keyValueMemo}
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
        <div className="h-4 bg-slate-100 grow border border-gray-300 rounded-md" />
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

SpacingPadding.propTypes = {
  partialValue: PropTypes.object,
  fragmentSelected: PropTypes.string,
  onSelectFragment: PropTypes.func
};

export default SpacingPadding;
