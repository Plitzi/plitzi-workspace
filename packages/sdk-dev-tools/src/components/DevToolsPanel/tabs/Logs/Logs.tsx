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
      {/* Toolbar */}
      <div className="flex shrink-0 items-center justify-between border-b border-zinc-200 bg-zinc-50 px-2 py-1 dark:border-zinc-700 dark:bg-zinc-800">
        <span className="font-mono text-zinc-400 dark:text-zinc-500">
          {items.length} {items.length === 1 ? 'entry' : 'entries'}
        </span>
        <button
          className="rounded px-2 py-0.5 text-xs text-zinc-500 transition-colors hover:bg-zinc-200 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-zinc-200"
          onClick={onClear}
        >
          <i className="fa-solid fa-trash-can mr-1" />
          Clear
        </button>
      </div>

      {/* Content */}
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
          {items.length === 0 ? (
            <div className="flex grow flex-col items-center justify-center gap-2 text-zinc-400 dark:text-zinc-500">
              <i className="fa-solid fa-terminal text-3xl opacity-20" />
              <span>No logs yet</span>
            </div>
          ) : (
            items
              .filter(item => !logTypeSelected || item.logType === logTypeSelected)
              .map((item, i) => (
                <Log key={i} category={item.category} time={item.time} params={item.params} message={item.message} />
              ))
          )}
        </div>
      </div>
    </div>
  );
};

export default Logs;
