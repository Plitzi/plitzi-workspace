// Packages
import React, { useState, useCallback } from 'react';
import classNames from 'classnames';
import noop from 'lodash/noop';

// Relatives
import Log from './Log';
import LogsSummary from '../LogsSummary';
import { ORIENTATION_HORIZONTAL, ORIENTATION_VERTICAL } from '../../DevToolsPanel';

/**
 * @param {{
 *   className?: string;
 *   items: object[];
 *   orientation: 'horizontal' | 'vertical';
 *   onClear?: () => void;
 * }} props
 * @returns {React.ReactElement}
 */
const Logs = props => {
  const { items = [], orientation = ORIENTATION_HORIZONTAL, onClear = noop } = props;
  const [logTypeSelected, setLogTypeSelected] = useState();

  const handleClickSummary = useCallback(logType => {
    setLogTypeSelected(logType);
  }, []);

  return (
    <div className="flex flex-col h-full w-full">
      <div className="flex border-b border-gray-300 px-2 py-1 gap-2 justify-between">
        <div />
        <button onClick={onClear}>Clear Logs</button>
      </div>
      <div
        className={classNames('flex w-full overflow-hidden', {
          'flex-col basis-0 grow': orientation === ORIENTATION_VERTICAL
        })}
      >
        <LogsSummary
          className={classNames({ 'h-full': orientation === ORIENTATION_HORIZONTAL })}
          logTypeSelected={logTypeSelected}
          items={items}
          orientation={orientation}
          onClick={handleClickSummary}
        />
        <div className="flex flex-col w-full overflow-y-auto">
          {items &&
            items
              .filter(item => !logTypeSelected || item.logType === logTypeSelected)
              .map((item, i) => (
                <Log key={i} category={item.category} time={item.time} params={item.params} message={item.message} />
              ))}
        </div>
      </div>
    </div>
  );
};

export default Logs;
