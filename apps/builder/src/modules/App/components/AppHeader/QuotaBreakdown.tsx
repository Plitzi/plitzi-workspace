import clsx from 'clsx';
import { useMemo, useState } from 'react';

import { elementsByRoot } from '@plitzi/sdk-schema';
import { useBuilderStore } from '@plitzi/sdk-shared/store';
import { format, refillsPeriodically } from '@pmodules/Space/hooks/useSpaceQuota';
import useSpaceUsage from '@pmodules/Space/hooks/useSpaceUsage';

import type { QuotaLevel, QuotaReading } from '@pmodules/Space/hooks/useSpaceQuota';
import type { ReactNode } from 'react';

const FILL: Record<QuotaLevel, string> = {
  ok: 'bg-primary-500',
  near: 'bg-amber-500',
  over: 'bg-red-500'
};

const FIGURE: Record<QuotaLevel, string> = {
  ok: 'text-ui-fg',
  near: 'text-amber-600 dark:text-amber-400',
  over: 'text-red-600 dark:text-red-400'
};

const METRIC: Record<QuotaReading['metric'], string> = { elements: 'Elements', views: 'Page views' };

const SCOPES: { scope: QuotaReading['scope']; title: string; hint: string }[] = [
  { scope: 'space', title: 'This space', hint: 'What this space holds and its visitors spent' },
  { scope: 'account', title: 'The account', hint: 'Every space of the account, this one included' }
];

/** How many rows a ranking shows before it is asked for the rest: the heaviest, which are the ones that matter. */
const SHOWN = 8;

/** A ranking only a few rows past `SHOWN` shows them all: a button that hides two hides nothing worth hiding. */
const FOLDS_PAST = SHOWN + 3;

type RankRow = { name: string; value: number };

/** The day the period ends, as a date (UTC: the period's boundary is the backend's). */
const dayOf = (iso: string): string =>
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

/** One allowance: the figure first, then how full it is — or that the plan sets no ceiling on it. */
const Metric = ({ entry }: { entry: QuotaReading }) => (
  <div className="flex min-w-0 flex-col gap-1.5">
    <span className="text-ui-fg-subtle text-[11px]">{METRIC[entry.metric]}</span>
    <span className={clsx('text-xl leading-none font-semibold tabular-nums', FIGURE[entry.level])}>
      {format(entry.used)}
    </span>
    {entry.unlimited ? (
      <span className="text-ui-fg-subtle text-[11px]">No limit on the plan</span>
    ) : (
      <>
        <span className="bg-ui-active h-1 w-full overflow-hidden rounded-full">
          <span
            className={clsx('block h-full rounded-full', FILL[entry.level])}
            style={{ width: `${String(Math.min(entry.percent ?? 0, 100))}%` }}
          />
        </span>
        <span className="text-ui-fg-subtle text-[11px] tabular-nums">
          {Math.round(entry.percent ?? 0)}% of {format(entry.quota)}
        </span>
      </>
    )}
  </div>
);

const Panel = ({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode }) => (
  <section className="bg-ui-raised border-ui-line flex min-w-0 flex-col gap-3 rounded-lg border p-3">
    <header className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
      <h5 className="text-ui-fg text-xs font-semibold">{title}</h5>
      {aside}
    </header>
    {children}
  </section>
);

/**
 * What a total is made of, heaviest first: each row's share drawn against the heaviest, so the few that weigh are seen
 * before any figure is read. The first rows show; the rest when asked.
 */
const Ranking = ({ rows, mono = false }: { rows: RankRow[]; mono?: boolean }) => {
  const [all, setAll] = useState(false);
  const top = rows[0]?.value ?? 0;
  const folds = rows.length > FOLDS_PAST;
  const shown = all || !folds ? rows : rows.slice(0, SHOWN);

  return (
    <div className="flex flex-col">
      {shown.map(row => (
        <div
          key={row.name}
          className="grid grid-cols-[minmax(0,1fr)_minmax(3rem,6rem)_3.5rem] items-center gap-3 py-1 text-[11px]"
        >
          <span className={clsx('text-ui-fg-muted truncate', { 'font-mono': mono })} title={row.name}>
            {row.name}
          </span>
          <span className="bg-ui-active h-1.5 overflow-hidden rounded-full">
            <span
              className="bg-primary-500/70 block h-full rounded-full"
              style={{ width: `${String(top > 0 ? (row.value / top) * 100 : 0)}%` }}
            />
          </span>
          <span className="text-ui-fg text-right tabular-nums">{format(row.value)}</span>
        </div>
      ))}
      {folds && (
        <button
          type="button"
          className="text-primary-text mt-1 cursor-pointer self-start text-[11px] hover:underline"
          onClick={() => setAll(current => !current)}
        >
          {all ? `Show the first ${String(SHOWN)}` : `Show all ${String(rows.length)}`}
        </button>
      )}
    </div>
  );
};

export type QuotaBreakdownProps = {
  readings: QuotaReading[];
  /** The space being edited, so it is answered from the store rather than from the figure the server last saved. */
  spaceId: number;
  liveElements: number;
};

/**
 * The number in the header, taken apart — for the space being edited.
 *
 * First the allowances, this space's beside the account's (the space spends both), each a figure and how full it is.
 * Then where this space's went, side by side: elements sit in pages, page views are spent by visitors on paths — each
 * ranked, heaviest first. How the workspace's other spaces spent theirs is the dashboard's to show, to its members.
 *
 * Its elements are answered from the store, so they are on screen before any request is made. Its page views are what
 * the request is for.
 */
const QuotaBreakdown = ({ readings, spaceId, liveElements }: QuotaBreakdownProps) => {
  const { usage, error, loading } = useSpaceUsage(spaceId);
  const [flat] = useBuilderStore('schema.flat');

  // Grouped here rather than in the meter's hook: the meter needs a count on every keystroke, this needs a grouping
  // only while somebody is reading it, and the panel is mounted only then.
  const livePages = useMemo(
    () => elementsByRoot(flat).map(page => ({ name: page.page, value: page.elements })),
    [flat]
  );
  const spaceViews = usage ? (usage.space?.views ?? usage.pagesTotal) : undefined;

  return (
    <div className="flex max-h-[75vh] flex-col gap-4 overflow-y-auto py-1 pr-1">
      {usage && (
        <p className="text-ui-fg-subtle flex flex-wrap items-center gap-x-2 text-xs">
          <span>
            Plan <b className="text-ui-fg">{usage.planName}</b>
          </span>
          {refillsPeriodically(readings) && (
            <>
              <span aria-hidden>·</span>
              <span>Page views start again on {dayOf(usage.periodEndsAt)}</span>
            </>
          )}
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {SCOPES.map(({ scope, title, hint }) => {
          const entries = readings.filter(entry => entry.scope === scope);

          return (
            entries.length > 0 && (
              <Panel key={scope} title={title} aside={<span className="text-ui-fg-subtle text-[11px]">{hint}</span>}>
                <div className="grid grid-cols-2 gap-4">
                  {entries.map(entry => (
                    <Metric key={entry.id} entry={entry} />
                  ))}
                </div>
              </Panel>
            )
          );
        })}
      </div>

      <div className="grid items-start gap-3 lg:grid-cols-2">
        <Panel
          title="Elements, by page"
          aside={<span className="text-ui-fg-subtle text-[11px] tabular-nums">{format(liveElements)} in all</span>}
        >
          <Ranking rows={livePages} />
        </Panel>

        <Panel
          title="Page views this period, by page"
          aside={
            spaceViews !== undefined && (
              <span className="text-ui-fg-subtle text-[11px] tabular-nums">{format(spaceViews)} in all</span>
            )
          }
        >
          {loading && <p className="text-ui-fg-subtle text-[11px]">Reading this space’s page views…</p>}
          {error && (
            <p className="text-[11px] text-amber-600 dark:text-amber-400">
              This space’s page views could not be read ({error}). The figures above are not affected.
            </p>
          )}
          {usage && usage.pages.length === 0 && (
            <p className="text-ui-fg-subtle text-[11px]">No page has been visited this period.</p>
          )}
          {usage && usage.pages.length > 0 && (
            <Ranking rows={usage.pages.map(page => ({ name: page.path, value: page.views }))} mono />
          )}
          {usage && spaceViews !== undefined && usage.pagesTotal < spaceViews && (
            <p className="text-ui-fg-subtle border-ui-line border-t pt-2 text-[11px]">
              The pages add up to {format(usage.pagesTotal)} of {format(spaceViews)}: data refreshes and server actions
              are counted for the space, not for a page.
            </p>
          )}
        </Panel>
      </div>
    </div>
  );
};

export default QuotaBreakdown;
