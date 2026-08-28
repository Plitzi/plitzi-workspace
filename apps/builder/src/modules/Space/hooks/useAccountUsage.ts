import { use, useEffect, useState } from 'react';

import NetworkContext from '@plitzi/sdk-shared/network/NetworkContext';

/** One page of a space and what it spent of the allowance this period. */
export interface UsagePage {
  path: string;
  views: number;
}

/** One page of a space and how many elements it holds — a grouping of `elements`, so it adds up to it exactly. */
export interface UsagePageElements {
  page: string;
  elements: number;
}

export interface UsageSpace {
  id: number;
  name: string;
  /** Page views this space spent this period — the same window the ceilings are judged over. */
  views: number;
  elements: number;
  /**
   * What the page rows add up to, which is not the same as `views`: an RSC refresh and a server action are charged to
   * the space and answered at their own endpoints, so they belong to no page.
   */
  pagesTotal: number;
  pages: UsagePage[];
  elementsByPage: UsagePageElements[];
}

export interface UsageKind {
  kind: string;
  label: string;
  origin: number;
  cached: number;
  weight: number;
  cachedWeight: number;
}

export interface AccountUsage {
  planName: string;
  periodEndsAt: string;
  usageByKind: UsageKind[];
  spaces: UsageSpace[];
}

/**
 * Where the account's allowance actually went — by space, and by page inside each one.
 *
 * The ceilings themselves come over GraphQL (`SpaceQuota`) and are what the header meter is made of: this space, this
 * account, and the two numbers each. This is the other half of the answer, and it is only worth a request when
 * somebody asks the question, which is why `enabled` exists — nothing is fetched until the panel is opened.
 *
 * It reads the API role rather than the GraphQL one because that is where the endpoint lives and where the same
 * figures are already served to the dashboard; the builder's user token rides in the header every other call uses.
 * Fetched once per panel: these are period totals, not something that moves while somebody reads them.
 */
const useAccountUsage = (enabled: boolean) => {
  const { server, userKey } = use(NetworkContext);
  const [usage, setUsage] = useState<AccountUsage>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!enabled || usage || error) {
      return undefined;
    }

    const controller = new AbortController();
    const load = async () => {
      try {
        const response = await fetch(`${server.apiServer}/account/usage`, {
          signal: controller.signal,
          credentials: 'include',
          headers: { 'plitzi-access-token': userKey }
        });

        if (!response.ok) {
          setError(`The server answered ${response.status}.`);

          return;
        }

        setUsage((await response.json()) as AccountUsage);
      } catch (err) {
        // An abort is this panel closing, not a failure: reporting it would leave an error on screen for the next
        // person who opens it.
        if (!controller.signal.aborted) {
          setError(err instanceof Error ? err.message : String(err));
        }
      }
    };

    void load();

    return () => controller.abort();
  }, [enabled, usage, error, server.apiServer, userKey]);

  return { usage, error, loading: enabled && !usage && !error };
};

export default useAccountUsage;
