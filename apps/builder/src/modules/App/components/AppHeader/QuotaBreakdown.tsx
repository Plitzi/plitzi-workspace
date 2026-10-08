import clsx from 'clsx';
import { useMemo } from 'react';

import { elementsByRoot } from '@plitzi/sdk-schema/helpers/elementTree';
import { useBuilderStore } from '@plitzi/sdk-shared/store';
import { format, refillsPeriodically } from '@pmodules/Space/hooks/useSpaceQuota';
import useSpaceUsage from '@pmodules/Space/hooks/useSpaceUsage';

import type { QuotaLevel, QuotaReading } from '@pmodules/Space/hooks/useSpaceQuota';
import type { ReactNode } from 'react';

const MUTED = 'text-zinc-500 dark:text-zinc-400';

const FILL: Record<QuotaLevel, string> = {
  ok: 'bg-primary-500',
  near: 'bg-yellow-500',
  over: 'bg-red-500'
};

type DetailRow = { name: string; value: number };

const Track = ({ percent, level = 'ok' }: { percent: number; level?: QuotaLevel }) => (
  <div className="h-1 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
    <div className={clsx('h-full rounded-full', FILL[level])} style={{ width: `${Math.min(percent, 100)}%` }} />
  </div>
);

/** One allowance: what is spent, out of what, and how full that is. */
const Allowance = ({ entry }: { entry: QuotaReading }) => (
  <div className="flex flex-col gap-1">
    <div className="flex items-baseline justify-between gap-3">
      <span className={clsx('text-[11px]', MUTED)}>{entry.label}</span>
      <span className="text-[11px]">
        <b className="text-zinc-800 dark:text-zinc-100">{format(entry.used)}</b>
        <span className={MUTED}>{entry.unlimited ? ' · no limit' : ` / ${format(entry.quota)}`}</span>
      </span>
    </div>
    {!entry.unlimited && <Track percent={entry.percent ?? 0} level={entry.level} />}
  </div>
);

const Section = ({ title, children }: { title: string; children: ReactNode }) => (
  <div className="flex flex-col gap-1.5">
    <h5 className={clsx('text-[11px] font-bold tracking-wider uppercase', MUTED)}>{title}</h5>
    {children}
  </div>
);

/**
 * A total and the pages behind it.
 *
 * A single row of detail is dropped: a one-page space's breakdown is its own total written twice.
 */
const Breakdown = ({ name, value, rows }: { name: string; value: number; rows: DetailRow[] }) => (
  <div className="flex flex-col gap-1">
    <div className="flex items-baseline justify-between gap-3 text-xs">
      <span className="font-semibold text-zinc-800 dark:text-zinc-100">{name}</span>
      <span className="font-semibold tabular-nums">{format(value)}</span>
    </div>
    {rows.length > 1 && (
      <div className="flex flex-col gap-px pt-0.5 pl-3">
        {rows.map(row => (
          <div key={row.name} className={clsx('flex justify-between gap-3 text-[11px]', MUTED)}>
            <span className="truncate">{row.name}</span>
            <span className="tabular-nums">{format(row.value)}</span>
          </div>
        ))}
      </div>
    )}
  </div>
);

export type QuotaBreakdownProps = {
  readings: QuotaReading[];
  /** The space being edited, so it is answered from the store rather than from the figure the server last saved. */
  spaceId: number;
  liveElements: number;
};

/**
 * The number in the header, taken apart — for the space being edited.
 *
 * The meter answers "how much room is left"; this answers what follows it — where this space's room went. Two
 * breakdowns, because the two ceilings are spent by different things: elements sit in pages, and page views are spent by
 * visitors on paths. The account's ceilings stay at the top, since the space spends them too; how the workspace's other
 * spaces spent them is the dashboard's to show, to its members.
 *
 * Its elements are answered from the store, so they are on screen before any request is made. Its page views are what
 * the request is for. Scrolls on its own: a space with many pages is longer than the window.
 */
const QuotaBreakdown = ({ readings, spaceId, liveElements }: QuotaBreakdownProps) => {
  const { usage, error, loading } = useSpaceUsage(spaceId);
  const [flat] = useBuilderStore('schema.flat');

  // Grouped here rather than in the meter's hook: the meter needs a count on every keystroke, this needs a grouping
  // only while somebody is reading it, and the panel is mounted only then.
  const livePages = useMemo(() => elementsByRoot(flat), [flat]);

  return (
    <div className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto py-1 pr-1">
      <div className="flex flex-col gap-2.5">
        {readings.map(entry => (
          <Allowance key={entry.id} entry={entry} />
        ))}
      </div>

      <Section title="This space, by page">
        <Breakdown
          name="Elements"
          value={liveElements}
          rows={livePages.map(page => ({ name: page.page, value: page.elements }))}
        />
      </Section>

      {loading && <div className={clsx('text-[11px]', MUTED)}>Reading this space’s page views…</div>}

      {error && (
        <div className="text-[11px] text-red-600 dark:text-red-400">
          This space’s page views could not be read ({error}). The figures above are unaffected.
        </div>
      )}

      {usage && (
        <Section title="Page views this period">
          <Breakdown
            name="Page views"
            value={usage.space?.views ?? usage.pagesTotal}
            rows={usage.pages.map(page => ({ name: page.path, value: page.views }))}
          />
        </Section>
      )}

      {usage && (
        <div className={clsx('text-[11px]', MUTED)}>
          Page rows count page renders; data refreshes and server actions belong to the space, not to a page. Plan{' '}
          <b>{usage.planName}</b>
          {refillsPeriodically(readings) ? `, resets ${new Date(usage.periodEndsAt).toLocaleDateString()}` : ''}.
        </div>
      )}
    </div>
  );
};

export default QuotaBreakdown;
