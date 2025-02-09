// Packages
import classNames from 'classnames';
import { useState, useCallback } from 'react';

// Relatives
import Log from './Log';
import LogsSummary from './LogsSummary';

// Types
import type { Orientation } from '../../../../DevToolsContainer';
import type { LogType, Log as TLog } from '../../../../DevToolsContext';

export type LogsProps = {
  items: TLog[];
  orientation: Orientation;
  onClear?: () => void;
};

const Logs = ({ items = [], orientation = 'horizontal', onClear }: LogsProps) => {
  const [logTypeSelected, setLogTypeSelected] = useState<LogType>();

  const handleClickSummary = useCallback((logType?: LogType) => {
    setLogTypeSelected(logType);
  }, []);

  return (
    <div className="flex flex-col h-full w-full">
      <div className="flex border-b border-gray-300 px-2 py-1 gap-2 justify-between">
        <div />
        <button onClick={onClear}>Clear Logs</button>
      </div>
      <div
        className={classNames('flex h-full w-full overflow-hidden', {
          'flex-col basis-0 grow': orientation === 'vertical'
        })}
      >
        <LogsSummary
          className={classNames({ 'h-full': orientation === 'horizontal' })}
          logTypeSelected={logTypeSelected}
          items={items}
          orientation={orientation}
          onClick={handleClickSummary}
        />
        <div className="flex flex-col basis-0 grow overflow-y-auto">
          {items
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
