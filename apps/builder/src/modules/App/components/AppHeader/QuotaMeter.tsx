import { useToast } from '@plitzi/plitzi-ui/Toast';
import clsx from 'clsx';
import { memo, useEffect, useMemo, useRef } from 'react';

import useSpaceQuota from '@pmodules/Space/hooks/useSpaceQuota';

import type { QuotaLevel, QuotaReading } from '@pmodules/Space/hooks/useSpaceQuota';

const format = (value: number): string => Math.round(value).toLocaleString();

const TEXT: Record<QuotaLevel, string> = {
  ok: 'text-zinc-500 dark:text-zinc-400',
  near: 'text-yellow-600 dark:text-yellow-400',
  over: 'text-red-600 dark:text-red-400'
};

const ICON: Record<QuotaLevel, string> = {
  ok: 'fa-cubes',
  near: 'fa-circle-exclamation',
  over: 'fa-triangle-exclamation'
};

/** `588 / 1,000`, or `588 · ∞` on a plan that sets no ceiling for it. */
const figure = (entry: QuotaReading) => (
  <span className="font-medium">
    {format(entry.used)}
    <span className="opacity-60">{entry.unlimited ? ' · ∞' : `/${format(entry.quota)}`}</span>
  </span>
);

/**
 * What this space is being edited against, in the header where the editing happens.
 *
 * It shows the ELEMENT count, live: the number comes from the schema in the store rather than from the server, so it
 * moves with every element added or removed and someone always knows how much room is left — the whole point of
 * putting it here rather than on a dashboard.
 *
 * It stays on screen on a plan with no element ceiling, showing the count against `∞`. Hiding it there was the first
 * cut and it was wrong: "how big is this space" is a question every author has, and answering it only for the
 * accounts that are running out of room is answering it for the wrong ones.
 *
 * The colour and the warnings come from the ENFORCED ceilings only — a limit that does not exist can never be near.
 */
const QuotaMeter = () => {
  const { readings, enforced, worst, featured } = useSpaceQuota();
  const { addToast } = useToast();
  // Warn on the CROSSING, not on the state: the element count moves with every drag, and a toast per drag past 90%
  // is noise that teaches people to dismiss the one that matters.
  const announced = useRef<Record<string, QuotaLevel>>({});

  useEffect(() => {
    for (const entry of enforced) {
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
            <b>{entry.label}</b> is at {Math.round(entry.percent ?? 0)}% of its limit ({format(entry.used)} of{' '}
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
  }, [enforced, addToast]);

  const breakdown = useMemo(
    () =>
      readings
        .map(entry =>
          entry.unlimited
            ? `${entry.label}: ${format(entry.used)} (no limit)`
            : `${entry.label}: ${format(entry.used)} / ${format(entry.quota)} (${Math.round(entry.percent ?? 0)}%)`
        )
        .join('\n'),
    [readings]
  );

  if (!featured) {
    return null;
  }

  const level = worst?.level ?? 'ok';

  return (
    <div
      id="header-quota"
      title={breakdown}
      className={clsx(
        'flex h-7 cursor-default items-center gap-1.5 rounded px-2 text-xs select-none',
        'transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800',
        TEXT[level]
      )}
    >
      <i className={clsx('fa-solid text-[10px]', ICON[level])} />
      {figure(featured)}
    </div>
  );
};

export default memo(QuotaMeter);
