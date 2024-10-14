// Packages
import React, { useState, useCallback } from 'react';
import classNames from 'classnames';

// Relatives
import DevToolsPanel, { ORIENTATION_HORIZONTAL, ORIENTATION_VERTICAL } from './components/DevToolsPanel/index.js';
import DevToolsContextProvider from './DevToolsContextProvider.js';

/**
 * @param {{
 *   className?: string;
 *   children: React.ReactNode;
 *   enabled: boolean;
 * }} props
 * @returns {React.ReactElement}
 */
const DevToolsContainer = props => {
  const { children, enabled = false } = props;
  const [orientation, setOrientation] = useState(ORIENTATION_HORIZONTAL);

  const handleChangeOrientation = useCallback(orientation => setOrientation(orientation), []);

  if (!enabled) {
    return children;
  }

  return (
    <DevToolsContextProvider>
      <div
        className={classNames('flex grow overflow-auto', {
          'flex-col': orientation === ORIENTATION_HORIZONTAL,
          'h-screen': orientation === ORIENTATION_VERTICAL
        })}
      >
        <div className="basis-0 grow overflow-auto">{children}</div>
        {enabled && <DevToolsPanel orientation={orientation} onChangeOrientation={handleChangeOrientation} />}
      </div>
    </DevToolsContextProvider>
  );
};

export default DevToolsContainer;
