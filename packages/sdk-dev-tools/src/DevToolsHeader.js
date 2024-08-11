// Packages
import React, { useCallback } from 'react';
import noop from 'lodash/noop';

// Relatives
import { ORIENTATION_HORIZONTAL, ORIENTATION_VERTICAL } from './DevToolsPanel';

/**
 * @param {{
 *   className?: string;
 *   children: React.ReactNode;
 *   orientation: 'vertical' | 'horizontal';
 *   onChangeOrientation: (orientation: 'horizontal' | 'vertical') => void;
 * }} props
 * @returns {React.ReactElement}
 */
const DevToolsHeader = props => {
  const { orientation = ORIENTATION_VERTICAL, onChangeOrientation = noop } = props;

  const handleClickOrientation = useCallback(() => {
    if (orientation === ORIENTATION_HORIZONTAL) {
      onChangeOrientation(ORIENTATION_VERTICAL);
    } else {
      onChangeOrientation(ORIENTATION_HORIZONTAL);
    }
  }, [orientation, onChangeOrientation]);

  return (
    <div className="flex justify-between grow border-b border-b-gray-300 px-2 py-1 bg-gray-200">
      <div className="flex gap-4">
        <div>Interactions</div>
        <div>Data Sources</div>
      </div>
      <div className="flex">
        <button onClick={handleClickOrientation}>Orientation</button>
      </div>
    </div>
  );
};

export default DevToolsHeader;
