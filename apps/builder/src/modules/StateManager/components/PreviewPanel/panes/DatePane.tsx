import clsx from 'clsx';
import { useMemo, useState } from 'react';

import { useBuilderStore } from '@plitzi/sdk-shared/store';
import { isWindowOpen } from '@plitzi/sdk-shared/timeWindows';

import SimulatedTime from '../../VisitorTab/components/SimulatedTime';

/** A bound of a window, as the pane says it: its instant in UTC to the minute, or none. */
const boundWords = (value: unknown): string =>
  typeof value === 'string' && value !== ''
    ? `${new Date(value).toISOString().slice(0, 16).replace('T', ' ')} UTC`
    : '';

/**
 * The date the preview is read at — the editor's clock until one is chosen — and every time window of the page the
 * canvas shows, open or closed at it.
 */
const DatePane = () => {
  const [[flat, currentPageId, simulatedAt]] = useBuilderStore([
    'schema.flat',
    'navigation.currentPageId',
    'simulatedAt'
  ]);
  const windows = useMemo(
    () =>
      Object.values(flat).filter(
        element => element.definition.type === 'timeWindow' && element.definition.rootId === currentPageId
      ),
    [flat, currentPageId]
  );
  // The editor's clock as the pane opened, until a date is chosen: what the canvas reads windows at then.
  const [openedAt] = useState(() => Date.now());
  const at = simulatedAt ?? openedAt;

  return (
    <div className="flex flex-col gap-3">
      <SimulatedTime />
      <section className="flex flex-col gap-1">
        <h6 className="text-ui-fg-subtle px-1 text-[10px] font-semibold tracking-wider uppercase">
          Time windows on this page
        </h6>
        {windows.length === 0 && <p className="text-ui-fg-subtle px-1 text-[11px]">This page has none.</p>}
        {windows.map(held => {
          const { startsAt, endsAt } = held.attributes;
          const open = isWindowOpen(at, startsAt, endsAt);

          return (
            <div key={held.id} className="flex items-center gap-2 rounded-md px-2 py-1">
              <span
                className={clsx('size-2 shrink-0 rounded-full', { 'bg-emerald-500': open, 'bg-ui-line-strong': !open })}
              />
              <span className="flex min-w-0 grow flex-col">
                <span className="text-ui-fg truncate font-mono text-[11px]">{held.id}</span>
                <span className="text-ui-fg-subtle truncate text-[10px]">
                  {boundWords(startsAt) || 'Always'} → {boundWords(endsAt) || 'no end'}
                </span>
              </span>
              <span
                className={clsx(
                  'shrink-0 text-[10px] font-semibold',
                  open ? 'text-emerald-600 dark:text-emerald-400' : 'text-ui-fg-subtle'
                )}
              >
                {open ? 'Shown' : 'Hidden'}
              </span>
            </div>
          );
        })}
      </section>
    </div>
  );
};

export default DatePane;
