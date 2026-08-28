import { useToast } from '@plitzi/plitzi-ui/Toast';
import clsx from 'clsx';
import { memo, useEffect, useMemo, useRef } from 'react';

import useSpaceQuota from '@pmodules/Space/hooks/useSpaceQuota';

import type { QuotaLevel } from '@pmodules/Space/hooks/useSpaceQuota';

const format = (value: number): string => Math.round(value).toLocaleString();

const TEXT: Record<QuotaLevel, string> = {
  ok: 'text-zinc-500 dark:text-zinc-400',
  near: 'text-yellow-600 dark:text-yellow-400',
  over: 'text-red-600 dark:text-red-400'
};

const ICON: Record<QuotaLevel, string> = {
  ok: 'fa-gauge-simple',
  near: 'fa-circle-exclamation',
  over: 'fa-triangle-exclamation'
};

/**
 * What this space is being edited against, in the header where the editing happens.
 *
 * It shows the ELEMENT budget, live: the count comes from the schema in the store rather than from the server, so it
 * moves with every element added or removed and someone always knows how much room is left — the whole point of
 * putting it here rather than on a dashboard. The colour follows whichever allowance is closest to its ceiling, and
 * the full breakdown is in the tooltip.
 *
 * Nothing renders while the plan enforces no ceiling at all: an unlimited plan has no bar to draw, and a meter
 * permanently at 0% is furniture.
 */
const QuotaMeter = () => {
  const { readings, worst, featured } = useSpaceQuota();
  const { addToast } = useToast();
  // Warn on the CROSSING, not on the state: the element count moves with every drag, and a toast per drag past 90%
  // is noise that teaches people to dismiss the one that matters.
  const announced = useRef<Record<string, QuotaLevel>>({});

  useEffect(() => {
    for (const entry of readings) {
      const previous = announced.current[entry.id] ?? 'ok';
      announced.current[entry.id] = entry.level;
      if (entry.level === previous || entry.level === 'ok') {
        continue;
      }

      addToast(
        entry.level === 'over' ? (
          <div>
            <b>{entry.label}</b> is over its limit ({format(entry.used)} of {format(entry.quota)}). Publishing is
            refused until it is back under.
          </div>
        ) : (
          <div>
            <b>{entry.label}</b> is at {Math.round(entry.percent)}% of its limit ({format(entry.used)} of{' '}
            {format(entry.quota)}).
          </div>
        ),
        {
          appeareance: entry.level === 'over' ? 'error' : 'warning',
          autoDismiss: entry.level !== 'over',
          placement: 'top-right'
        }
      );
    }
  }, [readings, addToast]);

  const breakdown = useMemo(
    () =>
      readings
        .map(entry => `${entry.label}: ${format(entry.used)} / ${format(entry.quota)} (${Math.round(entry.percent)}%)`)
        .join('\n'),
    [readings]
  );

  if (!featured || !worst) {
    return null;
  }

  return (
    <div
      id="header-quota"
      title={breakdown}
      className={clsx(
        'flex h-7 cursor-default items-center gap-1.5 rounded px-2 text-xs select-none',
        'transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800',
        TEXT[worst.level]
      )}
    >
      <i className={clsx('fa-solid text-[10px]', ICON[worst.level])} />
      <span className="font-medium">
        {format(featured.used)}
        <span className="opacity-60">/{format(featured.quota)}</span>
      </span>
    </div>
  );
};

export default memo(QuotaMeter);
