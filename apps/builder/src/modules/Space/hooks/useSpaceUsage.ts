import { useEffect, useState } from 'react';

import useBuilderNetwork from '@pmodules/Network/hooks/useBuilderNetwork';

/** One page of the space and what it spent of the allowance this period. */
export interface UsagePage {
  path: string;
  views: number;
}

/** Where this space's page views went this period, as `/spaces/:spaceId/usage` answers it. */
export interface SpaceUsage {
  planName: string;
  periodEndsAt: string;
  /** What this space spent; none where its plan sets no ceiling of its own. */
  space: { views: number } | null;
  /** The heaviest pages, by page views. */
  pages: UsagePage[];
  /**
   * What the page rows add up to, which is not the same as the space's views: an RSC refresh and a server action are
   * charged to the space and answered at their own endpoints, so they belong to no page.
   */
  pagesTotal: number;
}

/**
 * Where the allowance of the space being edited went, page by page — and only that space's: whoever edits a space is
 * asking about that one, and may be a guest with no business reading the rest of its workspace.
 *
 * The ceilings themselves come over GraphQL (`SpaceQuota`) and are what the header meter is made of. This is the other
 * half of the answer, asked for only while the panel showing it is mounted. It reads the API role, where the endpoint
 * lives; the builder's user token rides in the header every other call uses. Fetched once per panel: these are period
 * totals, not something that moves while somebody reads them.
 */
const useSpaceUsage = (spaceId: number) => {
  const { server, userKey } = useBuilderNetwork();
  const [usage, setUsage] = useState<SpaceUsage>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (usage || error) {
      return undefined;
    }

    const controller = new AbortController();
    const load = async () => {
      try {
        const response = await fetch(`${server.apiServer}/spaces/${String(spaceId)}/usage`, {
          signal: controller.signal,
          credentials: 'include',
          headers: { 'plitzi-access-token': userKey }
        });

        if (!response.ok) {
          setError(`The server answered ${String(response.status)}.`);

          return;
        }

        // The API's own answer, read as the shape it is documented to have.
        setUsage((await response.json()) as SpaceUsage);
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
  }, [spaceId, usage, error, server.apiServer, userKey]);

  return { usage, error, loading: !usage && !error };
};

export default useSpaceUsage;
