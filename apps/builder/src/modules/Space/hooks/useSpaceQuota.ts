import { useMemo } from 'react';

import { useBuilderStore } from '@plitzi/sdk-shared/store';
import useGraphQL from '@pmodules/Network/hooks/useGraphQL';

import type { TQuotaPlane, TSpaceQuota } from '@plitzi/sdk-shared';

/** A quota figure as it is shown: whole units, grouped. */
export const format = (value: number): string => Math.round(value).toLocaleString();

/** How close one ceiling is, as the three states a UI treats differently. */
export type QuotaLevel = 'ok' | 'near' | 'over';

export interface QuotaReading {
  /** Stable across renders, so a warning can be shown once rather than on every keystroke. */
  id: string;
  scope: 'space' | 'account';
  metric: 'elements' | 'views';
  label: string;
  used: number;
  /** The ceiling. 0 when the plan does not enforce one — see `unlimited`. */
  quota: number;
  /**
   * There is no ceiling on this plane.
   *
   * Kept as a reading rather than dropped, because the figure is still worth showing: someone on an unlimited plan
   * still wants to know their space holds 588 elements. What `unlimited` decides is that it can never be `near` or
   * `over`, so it never colours the meter and never raises a warning.
   */
  unlimited: boolean;
  percent: number | null;
  level: QuotaLevel;
}

/** The share of a ceiling past which someone should be told before they hit it rather than after. */
const NEAR_RATIO = 0.9;
/** How often the server figures are re-read. Page views move with visitors, not with edits. */
const REFRESH_MS = 5 * 60 * 1000;

const levelOf = (used: number, quota: number): QuotaLevel => {
  if (used > quota) {
    return 'over';
  }

  return used >= quota * NEAR_RATIO ? 'near' : 'ok';
};

const reading = (
  scope: QuotaReading['scope'],
  metric: QuotaReading['metric'],
  label: string,
  used: number,
  quota: number
): QuotaReading => ({
  id: `${scope}:${metric}`,
  scope,
  metric,
  label,
  used,
  quota,
  unlimited: quota <= 0,
  percent: quota > 0 ? (used / quota) * 100 : null,
  level: quota > 0 ? levelOf(used, quota) : 'ok'
});

export const readingsFor = (quota: TSpaceQuota, liveSpaceElements: number): QuotaReading[] => {
  const { space, account } = quota;

  /**
   * The account's element total, corrected to what is on screen.
   *
   * The server counted this space as it was last SAVED, and the builder is ahead of that from the first drag. What
   * the builder cannot know is what the account's other spaces hold — so the saved figure for this one is swapped
   * out of the total and the live one swapped in.
   */
  const savedHere = space?.elements ?? 0;
  const accountElements = Math.max((account.elements ?? 0) - savedHere + liveSpaceElements, 0);

  const planes: [QuotaReading['scope'], TQuotaPlane | null, number, number][] = [
    ['space', space, liveSpaceElements, space?.views ?? 0],
    ['account', account, accountElements, account.views]
  ];

  return planes.flatMap(([scope, plane, elements, views]) => {
    if (!plane) {
      return [];
    }

    const where = scope === 'space' ? 'this space' : 'this account';

    return [
      reading(scope, 'elements', `Elements · ${where}`, elements, plane.elementsQuota),
      reading(scope, 'views', `Page views · ${where}`, views, plane.viewsQuota)
    ];
  });
};

/**
 * Whether this plan has an allowance that comes back — the only case where a reset date says anything.
 *
 * The counters roll with the period on every plan, Lifetime included, so a date is always available; that is not the
 * same as it being worth showing. With no ceiling on page views there is nothing to get back, and "resets 1 Sep"
 * next to "Unlimited" reads as a limit that is not there. Elements never decide it: a schema is a stock, not a
 * flow, and it does not empty when the month does.
 */
export const refillsPeriodically = (readings: QuotaReading[]): boolean =>
  readings.some(entry => entry.metric === 'views' && !entry.unlimited);

const RANK: Record<QuotaLevel, number> = { ok: 0, near: 1, over: 2 };

/**
 * The plan ceilings this space is edited against, with the element counts corrected to the live schema.
 *
 * Element caps are the ones reached WHILE editing — someone drops a component and crosses one — so they are counted
 * off the store rather than off the server, and move as the page does. Page views are spent by visitors, so they come
 * from the server and are refreshed on a timer.
 */
const useSpaceQuota = () => {
  const [flat] = useBuilderStore('schema.flat');
  const { data, error } = useGraphQL('SpaceQuota', undefined, undefined, {
    refreshInterval: REFRESH_MS,
    revalidateOnFocus: false
  });

  const quota = data?.SpaceQuota ?? undefined;
  const liveElements = useMemo(() => Object.keys(flat as Record<string, unknown>).length, [flat]);

  const readings = useMemo(() => (quota ? readingsFor(quota, liveElements) : []), [quota, liveElements]);

  /**
   * The readings that can actually run out — the only ones that colour the meter or raise a warning.
   *
   * An unenforced ceiling is not "at 0%", it is absent: treating it as a bar to fill would put every unlimited plan
   * permanently in the green and, worse, make "you are near your limit" a thing that could be said about a limit
   * that does not exist.
   */
  const enforced = useMemo(() => readings.filter(entry => !entry.unlimited), [readings]);

  // Whatever is closest to biting. It colours the meter, so a green badge never sits next to an allowance that is
  // the one about to run out.
  const worst = useMemo(
    () =>
      enforced.reduce<QuotaReading | undefined>(
        (top, entry) =>
          !top ||
          RANK[entry.level] > RANK[top.level] ||
          (RANK[entry.level] === RANK[top.level] && (entry.percent ?? 0) > (top.percent ?? 0))
            ? entry
            : top,
        undefined
      ),
    [enforced]
  );

  /**
   * The figure the meter SHOWS, which is not the same question as which one is worst.
   *
   * Elements are what the person at this screen is spending — one drag is one more — so that is the number they need
   * permanently in view. It is featured whether or not it has a ceiling: on an unlimited plan the count is still the
   * thing someone wants to know, and hiding the meter there would mean the answer to "how big is this space" is
   * available only to the accounts that are running out of room.
   */
  const featured = useMemo(
    () => readings.find(entry => entry.id === 'space:elements') ?? readings.find(entry => entry.metric === 'elements'),
    [readings]
  );

  return { quota, readings, enforced, worst, featured, liveElements, error };
};

export default useSpaceQuota;
