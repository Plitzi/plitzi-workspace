import clsx from 'clsx';

import useSpaceEntitlements from '@pmodules/Space/hooks/useSpaceEntitlements';

import type { TSpaceServerPlays } from '@plitzi/sdk-shared/network';

export type PlanUsageProps = {
  /** The journeys the space keeps now, the one being written included. */
  journeys: number;
  /** The month's plays on the server, as the server last said them. */
  plays?: TSpaceServerPlays;
};

/** The day the month's plays start again, as the builder writes a date (UTC). */
const dayOf = (iso: string): string =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });

/** A count of a plan's allowance, as a bar: full, it says so — calmly, amber; nothing broke. */
const Meter = ({ used, limit }: { used: number; limit: number }) => (
  <span className="bg-ui-raised h-1 w-full overflow-hidden rounded-full">
    <span
      className={clsx('block h-full rounded-full', used >= limit ? 'bg-amber-500' : 'bg-primary-500')}
      style={{ width: `${String(Math.min(100, Math.round((used / Math.max(limit, 1)) * 100)))}%` }}
    />
  </span>
);

/**
 * What the space's plan allows of its tests, and how much of it is used: the journeys it keeps, and the journeys played
 * on the server this month — with when they come back, and the plan that gives more. Element checks, and plays in the
 * builder, count against nothing. Nothing at all where the server answers no plan (a self-hosted deployment).
 */
const PlanUsage = ({ journeys, plays }: PlanUsageProps) => {
  const { entitlements } = useSpaceEntitlements();
  if (!entitlements) {
    return null;
  }

  const kept = entitlements.journeysPerSpace;
  const limit = plays?.limit ?? entitlements.serverRunsPerMonth;
  const more = entitlements.moreJourneys ?? entitlements.moreServerRuns;
  const row = 'flex items-baseline justify-between gap-2 text-xs text-ui-fg-muted';
  const figure = 'font-semibold text-ui-fg tabular-nums';

  return (
    <section
      aria-label="What the plan allows"
      className="border-ui-line-strong flex shrink-0 flex-col gap-2 rounded-lg border px-3 py-2.5"
    >
      <span
        className="text-ui-fg-subtle flex items-center justify-between text-[11px] font-semibold tracking-wider uppercase"
        title="Element checks, and journeys played here in the builder, count against nothing."
      >
        {entitlements.tierLabel} plan
        {more && (
          <a
            href={more.upgradeUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="text-primary-text text-xs font-medium tracking-normal normal-case hover:underline"
          >
            See the plans
          </a>
        )}
      </span>
      <div className="flex flex-col gap-1">
        <span className={row}>
          Journeys kept
          <span>
            <b className={figure}>{journeys}</b> {kept === null ? '· no limit' : `of ${String(kept)}`}
          </span>
        </span>
        {kept !== null && <Meter used={journeys} limit={kept} />}
      </div>
      <div className="flex flex-col gap-1">
        <span className={row}>
          Played on the server this month
          {/* A plan with no limit counts nothing: a number there would be a count nobody kept. */}
          {limit === null ? (
            <b className={figure}>No limit</b>
          ) : (
            <span>
              <b className={figure}>{plays?.used ?? '—'}</b> of {limit}
            </span>
          )}
        </span>
        {limit !== null && plays?.used !== undefined && plays.used !== null && (
          <Meter used={plays.used} limit={limit} />
        )}
        {limit !== null && plays && (
          <span className="text-ui-fg-subtle text-[11px]">
            {plays.used === null
              ? 'The count could not be read just now — runs are not held back by it.'
              : `${String(Math.max(0, limit - plays.used))} left · they start again on ${dayOf(plays.resetsOn)}`}
          </span>
        )}
      </div>
    </section>
  );
};

export default PlanUsage;
