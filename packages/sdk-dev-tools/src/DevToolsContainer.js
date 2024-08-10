// Packages
import React, { useState, useCallback } from 'react';
import classNames from 'classnames';

// Relatives
import DevToolsPanel, { ORIENTATION_HORIZONTAL, ORIENTATION_VERTICAL } from './DevToolsPanel';

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
  const [orientation, setOrientation] = useState(ORIENTATION_VERTICAL);

  const handleChangeOrientation = useCallback(orientation => setOrientation(orientation), []);

  if (!enabled) {
    return children;
  }

  return (
    <div className={classNames('flex grow', { 'flex-col': orientation === ORIENTATION_HORIZONTAL })}>
      <div className="basis-0 grow">{children}</div>
      {enabled && <DevToolsPanel orientation={orientation} onChangeOrientation={handleChangeOrientation} />}
    </div>
  );
};

export default DevToolsContainer;
