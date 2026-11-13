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
  /** Filter the tab opens on. Read once, on mount: from there the summary owns the filter. */
  logTypeFilter?: LogType;
  onClear?: () => void;
};

const Logs = ({ items = [], autoScrollOffset = 40, orientation = 'horizontal', logTypeFilter, onClear }: LogsProps) => {
  const [logTypeSelected, setLogTypeSelected] = useState<LogType | undefined>(logTypeFilter);
  const listRef = useRef<HTMLDivElement | null>(null);
  const isUserNearTopRef = useRef(true);

  // Newest entry sits at the top, so auto-follow scrolls to the top (not the bottom) when the user is already there.
  useEffect(() => {
    const el = listRef.current;
    if (!el) {
      return;
    }

    if (isUserNearTopRef.current) {
      el.scrollTop = 0;
    }
  }, [items]);

  const handleScroll = useCallback(() => {
    const el = listRef.current;
    if (!el) {
      return;
    }

    isUserNearTopRef.current = el.scrollTop <= autoScrollOffset;
  }, [autoScrollOffset]);

  const handleClickSummary = useCallback((logType?: LogType) => {
    setLogTypeSelected(logType);
  }, []);

  return (
    <div className="flex h-full w-full flex-col">
      {/* Toolbar */}
      <div className="border-ui-line bg-ui-raised flex shrink-0 items-center justify-between border-b px-2 py-1">
        <span className="text-ui-fg-subtle font-mono">
          {items.length} {items.length === 1 ? 'entry' : 'entries'}
        </span>
        <button
          className="text-ui-fg-subtle hover:bg-ui-hover hover:text-ui-fg rounded px-2 py-0.5 text-xs transition-colors"
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
            <div className="text-ui-fg-subtle flex grow flex-col items-center justify-center gap-2">
              <i className="fa-solid fa-terminal text-3xl opacity-20" />
              <span>No logs yet</span>
            </div>
          ) : (
            items
              .map((item, i) => ({ item, key: i }))
              .filter(({ item }) => !logTypeSelected || item.logType === logTypeSelected)
              .reverse()
              .map(({ item, key }) => <Log key={key} log={item} />)
          )}
        </div>
      </div>
    </div>
  );
};

export default Logs;
