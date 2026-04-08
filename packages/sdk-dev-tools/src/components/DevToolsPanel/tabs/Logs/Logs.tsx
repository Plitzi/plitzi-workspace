import Button from '@plitzi/plitzi-ui/Button';
import clsx from 'clsx';
import { useState, useCallback, useEffect, useRef } from 'react';

import Log from './Log';
import LogsSummary from './LogsSummary';

import type { Orientation } from '../../../../DevToolsContainer';
import type { LogType, Log as TLog } from '@plitzi/sdk-shared';

export type LogsProps = {
  items: TLog[];
  autoScrollOffset?: number;
  orientation: Orientation;
  onClear?: () => void;
};

const Logs = ({ items = [], autoScrollOffset = 40, orientation = 'horizontal', onClear }: LogsProps) => {
  const [logTypeSelected, setLogTypeSelected] = useState<LogType>();
  const listRef = useRef<HTMLDivElement | null>(null);
  const isUserNearBottomRef = useRef(true);

  useEffect(() => {
    const el = listRef.current;
    if (!el) {
      return;
    }

    if (isUserNearBottomRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [items]);

  const handleScroll = useCallback(() => {
    const el = listRef.current;
    if (!el) {
      return;
    }

    const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight <= autoScrollOffset;
    isUserNearBottomRef.current = isNearBottom;
  }, [autoScrollOffset]);

  const handleClickSummary = useCallback((logType?: LogType) => {
    setLogTypeSelected(logType);
  }, []);

  return (
    <div className="flex h-full w-full flex-col">
      <div className="flex justify-between gap-2 border-b border-gray-300 px-2 py-1">
        <div />
        <Button size="xs" onClick={onClear}>
          Clear Logs
        </Button>
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
        <div ref={listRef} onScroll={handleScroll} className="flex grow basis-0 flex-col overflow-y-auto">
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
