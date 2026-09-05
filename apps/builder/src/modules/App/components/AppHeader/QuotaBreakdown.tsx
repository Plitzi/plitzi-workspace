import clsx from 'clsx';
import { useMemo } from 'react';

import { useBuilderStore } from '@plitzi/sdk-shared/store';
import elementsByRoot from '@pmodules/Space/helpers/elementsByRoot';
import useAccountUsage from '@pmodules/Space/hooks/useAccountUsage';
import { format, refillsPeriodically } from '@pmodules/Space/hooks/useSpaceQuota';

import type { Element } from '@plitzi/sdk-shared';
import type { QuotaLevel, QuotaReading } from '@pmodules/Space/hooks/useSpaceQuota';
import type { ReactNode } from 'react';

const MUTED = 'text-zinc-500 dark:text-zinc-400';

const FILL: Record<QuotaLevel, string> = {
  ok: 'bg-indigo-500',
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
    <h5 className={clsx('text-[10px] font-bold tracking-wider uppercase', MUTED)}>{title}</h5>
    {children}
  </div>
);

/**
 * One space: what it holds or spent, how much of the account that is, and the pages behind it.
 *
 * The bar is its share of the account TOTAL, not of the plan's ceiling — the question this answers is which of these
 * is the big one, and on a plan with room to spare every bar drawn against a ceiling would be the same empty sliver.
 *
 * A single row of detail is dropped: a one-page space's breakdown is its own total written twice.
 */
const Space = ({ name, value, share, rows }: { name: string; value: number; share: number; rows: DetailRow[] }) => (
  <div className="flex flex-col gap-1">
    <div className="flex items-baseline justify-between gap-3 text-xs">
      <span className="font-semibold text-zinc-800 dark:text-zinc-100">{name}</span>
      <span className="font-semibold tabular-nums">{format(value)}</span>
    </div>
    <Track percent={share} />
    {rows.length > 1 && (
      <div className="flex flex-col gap-px pt-0.5 pl-3">
        {rows.map(row => (
          <div key={row.name} className={clsx('flex justify-between gap-3 text-[11px]', MUTED)}>
            <span>{row.name}</span>
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
 * The number in the header, taken apart.
 *
 * The meter answers "how much room is left"; this answers what follows it — where the room went. Two breakdowns,
 * because the two ceilings are spent by different things: elements sit in pages, and page views are spent by
 * visitors on paths.
 *
 * The space being edited is answered entirely from the store, so it is on screen before any request is made, and it
 * is there even for someone whose account owns none of this. The rest of the account is what the request is for.
 */
const QuotaBreakdown = ({ readings, spaceId, liveElements }: QuotaBreakdownProps) => {
  const { usage, error, loading } = useAccountUsage(true);
  const [flat] = useBuilderStore('schema.flat');

  // Grouped here rather than in the meter's hook: the meter needs a count on every keystroke, this needs a grouping
  // only while somebody is reading it, and the panel is mounted only then.
  const livePages = useMemo(() => elementsByRoot(flat as Record<string, Element>), [flat]);

  // This space is answered from the store above, so it is dropped here rather than listed twice.
  const others = usage?.spaces.filter(space => space.id !== spaceId) ?? [];
  // A list of zeroes is the longest way to say nothing.
  const spent = usage?.spaces.filter(space => space.views > 0) ?? [];

  return (
    <div className="flex flex-col gap-4 py-1">
      <div className="flex flex-col gap-2.5">
        {readings.map(entry => (
          <Allowance key={entry.id} entry={entry} />
        ))}
      </div>

      <Section title="This space, by page">
        <Space
          name="Elements"
          value={liveElements}
          share={100}
          rows={livePages.map(page => ({ name: page.page, value: page.elements }))}
        />
      </Section>

      {loading && <div className={clsx('text-[11px]', MUTED)}>Reading the rest of the account…</div>}

      {error && (
        <div className="text-[11px] text-red-600 dark:text-red-400">
          The account breakdown could not be read ({error}). The figures above are unaffected — they come from the space
          you are editing.
        </div>
      )}

      {others.length > 0 && (
        <Section title="Elements in your other spaces">
          <div className="flex flex-col gap-2">
            {[...others]
              .sort((a, b) => b.elements - a.elements)
              .map(space => (
                <Space
                  key={space.id}
                  name={space.name}
                  value={space.elements}
                  share={space.elementsShare}
                  rows={
                    space.multiPage ? space.elementsByPage.map(page => ({ name: page.page, value: page.elements })) : []
                  }
                />
              ))}
          </div>
        </Section>
      )}

      {spent.length > 0 && (
        <Section title="Page views this period">
          <div className="flex flex-col gap-2">
            {[...spent]
              .sort((a, b) => b.views - a.views)
              .map(space => (
                <Space
                  key={space.id}
                  name={space.name}
                  value={space.views}
                  share={space.viewsShare}
                  rows={space.pages.map(page => ({ name: page.path, value: page.views }))}
                />
              ))}
          </div>
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
