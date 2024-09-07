// Packages
import React, { useState, useCallback } from 'react';
import classNames from 'classnames';

// Relatives
import Log from './Log';
import LogsSummary from '../LogsSummary';
import { ORIENTATION_HORIZONTAL, ORIENTATION_VERTICAL } from '../../DevToolsPanel';

/**
 * @param {{
 *   className?: string;
 *   items: object[];
 *   orientation: 'horizontal' | 'vertical';
 * }} props
 * @returns {React.ReactElement}
 */
const Logs = props => {
  const { items = [], orientation = ORIENTATION_HORIZONTAL } = props;
  const [logTypeSelected, setLogTypeSelected] = useState();

  const handleClickSummary = useCallback(logType => {
    setLogTypeSelected(logType);
  }, []);

  return (
    <div className={classNames('flex min-h-full w-full', { 'flex-col': orientation === ORIENTATION_VERTICAL })}>
      <LogsSummary
        className={classNames({ 'h-full': orientation === ORIENTATION_HORIZONTAL })}
        logTypeSelected={logTypeSelected}
        items={items}
        orientation={orientation}
        onClick={handleClickSummary}
      />
      <div className="flex flex-col grow h-full overflow-y-auto">
        {items &&
          items
            .filter(item => !logTypeSelected || item.logType === logTypeSelected)
            .map((item, i) => (
              <Log key={i} category={item.category} time={item.time} params={item.params} message={item.message} />
            ))}
      </div>
    </div>
  );
};

export default Logs;
