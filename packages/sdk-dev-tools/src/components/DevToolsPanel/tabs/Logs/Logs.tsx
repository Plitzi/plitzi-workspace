import clsx from 'clsx';
import { useState, useCallback } from 'react';

import Log from './Log';
import LogsSummary from './LogsSummary';

import type { Orientation } from '../../../../DevToolsContainer';
import type { LogType, Log as TLog } from '@plitzi/sdk-shared';

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
    <div className="flex h-full w-full flex-col">
      <div className="flex justify-between gap-2 border-b border-gray-300 px-2 py-1">
        <div />
        <button onClick={onClear}>Clear Logs</button>
      </div>
      <div
        className={clsx('flex h-full w-full overflow-hidden', {
          'grow basis-0 flex-col': orientation === 'vertical'
        })}
      >
        <LogsSummary
          className={clsx({ 'h-full': orientation === 'horizontal' })}
          logTypeSelected={logTypeSelected}
          items={items}
          orientation={orientation}
          onClick={handleClickSummary}
        />
        <div className="flex grow basis-0 flex-col overflow-y-auto">
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
