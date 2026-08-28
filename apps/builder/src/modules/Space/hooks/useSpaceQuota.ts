import { useMemo } from 'react';

import { useBuilderStore } from '@plitzi/sdk-shared/store';
import useGraphQL from '@pmodules/Network/hooks/useGraphQL';

import type { TQuotaPlane, TSpaceQuota } from '@plitzi/sdk-shared';

/** How close one ceiling is, as the three states a UI treats differently. */
export type QuotaLevel = 'ok' | 'near' | 'over';

export interface QuotaReading {
  /** Stable across renders, so a warning can be shown once rather than on every keystroke. */
  id: string;
  scope: 'space' | 'account';
  metric: 'elements' | 'views';
  label: string;
  used: number;
  quota: number;
  percent: number;
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
): QuotaReading | undefined =>
  // A ceiling of 0 is "not enforced": there is nothing to be near, and a bar drawn against it would read as full.
  quota > 0
    ? {
        id: `${scope}:${metric}`,
        scope,
        metric,
        label,
        used,
        quota,
        percent: (used / quota) * 100,
        level: levelOf(used, quota)
      }
    : undefined;

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
    ].filter((entry): entry is QuotaReading => entry !== undefined);
  });
};

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

  // Whatever is closest to biting. It colours the meter, so a green badge never sits next to an allowance that is
  // the one about to run out.
  const worst = useMemo(
    () =>
      readings.reduce<QuotaReading | undefined>(
        (top, entry) =>
          !top ||
          RANK[entry.level] > RANK[top.level] ||
          (RANK[entry.level] === RANK[top.level] && entry.percent > top.percent)
            ? entry
            : top,
        undefined
      ),
    [readings]
  );

  /**
   * The figure the meter SHOWS, which is not the same question as which one is worst.
   *
   * Elements are what the person at this screen is spending — one drag is one more — so that is the number they
   * need permanently in view to know how much room is left. The space's own ceiling first, the account's when the
   * plan does not set one; when neither is enforced there is no element budget to report and the meter falls back
   * to whatever else is closest.
   */
  const featured = useMemo(
    () =>
      readings.find(entry => entry.metric === 'elements' && entry.scope === 'space') ??
      readings.find(entry => entry.metric === 'elements') ??
      worst,
    [readings, worst]
  );

  return { quota, readings, worst, featured, liveElements, error };
};

export default useSpaceQuota;
