import clsx from 'clsx';
import { useMemo } from 'react';

import { useBuilderStore } from '@plitzi/sdk-shared/store';
import elementsByRoot from '@pmodules/Space/helpers/elementsByRoot';
import useAccountUsage from '@pmodules/Space/hooks/useAccountUsage';
import { format, refillsPeriodically } from '@pmodules/Space/hooks/useSpaceQuota';

import type { Element } from '@plitzi/sdk-shared';
import type { UsageSpace } from '@pmodules/Space/hooks/useAccountUsage';
import type { QuotaLevel, QuotaReading } from '@pmodules/Space/hooks/useSpaceQuota';

const BAR: Record<QuotaLevel, string> = {
  ok: 'bg-indigo-500',
  near: 'bg-yellow-500',
  over: 'bg-red-500'
};

const Bar = ({ entry }: { entry: QuotaReading }) => (
  <div className="flex flex-col gap-1">
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-xs text-zinc-500 dark:text-zinc-400">{entry.label}</span>
      <span className="text-xs">
        <b className="text-zinc-800 dark:text-zinc-100">{format(entry.used)}</b>
        <span className="text-zinc-500 dark:text-zinc-400">
          {entry.unlimited ? ' · no limit' : ` / ${format(entry.quota)}`}
        </span>
      </span>
    </div>
    {!entry.unlimited && (
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
        <div
          className={clsx('h-full rounded-full', BAR[entry.level])}
          style={{ width: `${Math.min(entry.percent ?? 0, 100)}%` }}
        />
      </div>
    )}
  </div>
);

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="flex flex-col gap-2">
    <h5 className="text-xs font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">{title}</h5>
    {children}
  </div>
);

const Row = ({ name, value, muted = false }: { name: string; value: string; muted?: boolean }) => (
  <div className="flex items-baseline justify-between gap-3 text-xs">
    <span className={muted ? 'text-zinc-500 dark:text-zinc-400' : 'text-zinc-800 dark:text-zinc-100'}>{name}</span>
    <span className={clsx('tabular-nums', muted ? 'text-zinc-500 dark:text-zinc-400' : 'font-medium')}>{value}</span>
  </div>
);

export type QuotaBreakdownProps = {
  readings: QuotaReading[];
  /** The space being edited, so its row can be marked and shown at its LIVE size rather than its saved one. */
  spaceId: number;
  liveElements: number;
};

/**
 * The number in the header, taken apart.
 *
 * The meter answers "how much room is left"; this answers the question that follows it — where the room went. Two
 * different breakdowns, because the two ceilings are spent by different things: elements sit in spaces, and page
 * views are spent by visitors on pages.
 *
 * The ceilings and the live element count come from the meter's own hook, so this panel opens with them already on
 * screen; only the per-space and per-page figures are fetched, and only when someone opens it.
 */
const QuotaBreakdown = ({ readings, spaceId, liveElements }: QuotaBreakdownProps) => {
  const { usage, error, loading } = useAccountUsage(true);
  const [flat] = useBuilderStore('schema.flat');

  // Grouped here rather than in the meter's hook: the meter needs a count on every keystroke, this needs a grouping
  // only while somebody is reading it, and the panel is mounted only then.
  const livePages = useMemo(() => elementsByRoot(flat as Record<string, Element>), [flat]);

  // The server counted this space as it was last SAVED; the builder has been ahead of that since the first drag.
  const elementsOf = (space: UsageSpace) => (space.id === spaceId ? liveElements : space.elements);
  const pagesOf = (space: UsageSpace) => (space.id === spaceId ? livePages : space.elementsByPage);

  const refills = refillsPeriodically(readings);

  return (
    <div className="flex flex-col gap-5 py-1 text-sm">
      <Section title="This space and this account">
        <div className="flex flex-col gap-3">
          {readings.map(entry => (
            <Bar key={entry.id} entry={entry} />
          ))}
        </div>
      </Section>

      {loading && <div className="text-xs text-zinc-500 dark:text-zinc-400">Reading the rest of the account…</div>}

      {error && (
        <div className="text-xs text-red-600 dark:text-red-400">
          The account breakdown could not be read ({error}). The figures above are unaffected — they come from the space
          you are editing.
        </div>
      )}

      {usage && (
        <>
          <Section title="Elements by page">
            <div className="flex flex-col gap-3">
              {[...usage.spaces]
                .sort((a, b) => elementsOf(b) - elementsOf(a))
                .map(space => (
                  <div key={space.id} className="flex flex-col gap-1">
                    <Row
                      name={space.id === spaceId ? `${space.name} · editing` : space.name}
                      value={format(elementsOf(space))}
                    />
                    {pagesOf(space).map(page => (
                      <div key={page.page} className="pl-3">
                        <Row name={page.page} value={format(page.elements)} muted />
                      </div>
                    ))}
                  </div>
                ))}
            </div>
          </Section>

          <Section title="Page views by space, this period">
            <div className="flex flex-col gap-3">
              {[...usage.spaces]
                .sort((a, b) => b.views - a.views)
                .map(space => (
                  <div key={space.id} className="flex flex-col gap-1">
                    <Row name={space.name} value={format(space.views)} />
                    {space.pages.map(page => (
                      <div key={page.path} className="pl-3">
                        <Row name={page.path} value={format(page.views)} muted />
                      </div>
                    ))}
                    {space.views > 0 && space.pages.length === 0 && (
                      <div className="pl-3 text-xs text-zinc-500 dark:text-zinc-400">
                        Nothing charged to a page — see the note below.
                      </div>
                    )}
                  </div>
                ))}
            </div>
          </Section>

          <div className="text-xs text-zinc-500 dark:text-zinc-400">
            Page rows count page renders. Data refreshes and server actions are charged to the space but are answered at
            their own endpoints, so they belong to no page. Plan <b>{usage.planName}</b>
            {refills ? `, resets ${new Date(usage.periodEndsAt).toLocaleDateString()}` : ''}.
          </div>
        </>
      )}
    </div>
  );
};

export default QuotaBreakdown;
